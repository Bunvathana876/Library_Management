package com.library.management;

import com.library.management.dto.BorrowRequest;
import com.library.management.exception.BusinessRuleException;
import com.library.management.model.*;
import com.library.management.repository.*;
import com.library.management.service.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.support.TransactionTemplate;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.function.Supplier;
import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
class CirculationConcurrencyIntegrationTest extends PostgresIntegrationTest {
    @Autowired LoanService service;
    @Autowired HoldService holdService;
    @Autowired BookRepository books;
    @Autowired BookCopyRepository copies;
    @Autowired MemberRepository members;
    @Autowired LoanRepository loans;
    @Autowired HoldRepository holds;
    @Autowired TransactionTemplate transactions;
    @Autowired JdbcTemplate jdbc;

    Member member() { return members.save(new Member("Concurrent reader", UUID.randomUUID()+"@race.test")); }
    BookCopy copy() {
        Book book = books.save(new Book("Concurrency", "Author", 2020));
        return copies.save(new BookCopy(book, UUID.randomUUID().toString(), BookCopyStatus.AVAILABLE, null, null));
    }
    BorrowRequest request(BookCopy copy, Member member) {
        return new BorrowRequest(copy.getBook().getId(), member.getId(), copy.getId());
    }
    // Barrier is inside two independent transactions/connections, before either service call.
    List<Object> race(Supplier<?> first, Supplier<?> second) throws Exception {
        CyclicBarrier start = new CyclicBarrier(2);
        try (ExecutorService pool = Executors.newFixedThreadPool(2)) {
            List<Future<Object>> work = new ArrayList<>();
            for (Supplier<?> action : List.of(first, second)) work.add(pool.submit(() -> {
                try {
                    return transactions.execute(status -> {
                        assertEquals("read committed", jdbc.queryForObject("show transaction_isolation", String.class));
                        try { start.await(10, TimeUnit.SECONDS); }
                        catch (Exception e) { throw new IllegalStateException(e); }
                        return action.get();
                    });
                } catch (BusinessRuleException e) { return e; }
            }));
            return List.of(work.get(0).get(20, TimeUnit.SECONDS), work.get(1).get(20, TimeUnit.SECONDS));
        }
    }
    List<Object> raceBehindMemberLock(Member member, Supplier<?> first, Supplier<?> second) throws Exception {
        try (ExecutorService pool = Executors.newFixedThreadPool(2)) {
            List<Future<Object>> work = new ArrayList<>();
            transactions.executeWithoutResult(tx -> {
                members.findByIdForUpdate(member.getId()).orElseThrow();
                CountDownLatch entered = new CountDownLatch(2);
                for (Supplier<?> action : List.of(first,second)) work.add(pool.submit(() -> {
                    entered.countDown();
                    try { return action.get(); } catch (BusinessRuleException ex) { return ex; }
                }));
                try { assertTrue(entered.await(10,TimeUnit.SECONDS)); }
                catch (InterruptedException ex) { Thread.currentThread().interrupt(); throw new IllegalStateException(ex); }
                long deadline=System.nanoTime()+TimeUnit.SECONDS.toNanos(10);
                int blocked=0;
                while (System.nanoTime()<deadline) {
                    jdbc.execute("SELECT pg_stat_clear_snapshot()");
                    blocked=jdbc.queryForObject("SELECT count(*) FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid() AND wait_event_type='Lock' AND query ILIKE '%members%'",Integer.class);
                    if (blocked==2) break;
                    java.util.concurrent.locks.LockSupport.parkNanos(TimeUnit.MILLISECONDS.toNanos(10));
                }
                assertEquals(2,blocked,"Both checkouts must reach and wait on the database member lock before release");
            });
            return List.of(work.get(0).get(20,TimeUnit.SECONDS),work.get(1).get(20,TimeUnit.SECONDS));
        }
    }
    @Test void differentBooksCannotExceedMemberLimit() throws Exception {
        Member member = member();
        for (int i=0;i<4;i++) service.borrow(request(copy(), member));
        BookCopy a=copy(), b=copy();
        var results = raceBehindMemberLock(member, () -> service.borrow(request(a, member)), () -> service.borrow(request(b, member)));
        assertEquals(1, results.stream().filter(BusinessRuleException.class::isInstance).count());
        var rejected = (BusinessRuleException) results.stream().filter(BusinessRuleException.class::isInstance).findFirst().orElseThrow();
        assertTrue(rejected.getMessage().contains("Borrowing limit reached (5/5"));
        assertEquals(5, loans.countByMemberIdAndReturnedOnIsNull(member.getId()));
        assertEquals(1, List.of(a,b).stream().filter(c -> copies.findById(c.getId()).orElseThrow().getStatus()==BookCopyStatus.AVAILABLE).count());
        for (BookCopy c : List.of(a,b)) assertEquals(
            copies.findById(c.getId()).orElseThrow().getStatus()==BookCopyStatus.AVAILABLE,
            books.findById(c.getBook().getId()).orElseThrow().isAvailable());
    }
    @Test void onePhysicalCopyHasExactlyOneBorrower() throws Exception {
        BookCopy copy=copy(); Member a=member(), b=member();
        var results=race(() -> service.borrow(request(copy,a)), () -> service.borrow(request(copy,b)));
        assertEquals(1, results.stream().filter(BusinessRuleException.class::isInstance).count());
        assertEquals(1, loans.countByMemberIdAndReturnedOnIsNull(a.getId())+loans.countByMemberIdAndReturnedOnIsNull(b.getId()));
        assertEquals(BookCopyStatus.LOANED, copies.findById(copy.getId()).orElseThrow().getStatus());
    }
    @Test void simultaneousExpiryAllocatesReleasedCopyOnlyOnce() throws Exception {
        BookCopy copy=copy(); Member old=member(), a=member(), b=member();
        transactions.executeWithoutResult(tx -> {
            BookCopy c=copies.findById(copy.getId()).orElseThrow(); c.setStatus(BookCopyStatus.ON_HOLD);
            c.getBook().setAvailable(false);
            Hold expired=new Hold(c.getBook(),old,Instant.now().minusSeconds(100));
            expired.setCopy(c); expired.markReadyForPickup(Instant.now().minusSeconds(100),LocalDate.now().minusDays(1));
            holds.save(expired);
            holds.save(new Hold(c.getBook(),a,Instant.now().minusSeconds(50)));
            holds.save(new Hold(c.getBook(),b,Instant.now()));
        });
        var results=race(() -> holdService.expireStaleReadyHolds(), () -> holdService.expireStaleReadyHolds());
        assertEquals(1, results.stream().mapToInt(v -> (Integer)v).sum());
        transactions.executeWithoutResult(tx -> {
            var ready=holds.findAllByBookIdAndStatusOrderByPlacedAtAscIdAsc(copy.getBook().getId(),HoldStatus.READY_FOR_PICKUP);
            assertEquals(1,ready.size()); assertEquals(a.getId(),ready.getFirst().getMember().getId());
            assertEquals(copy.getId(),ready.getFirst().getCopy().getId());
            assertEquals(1,holds.findAllByBookIdAndStatusOrderByPlacedAtAscIdAsc(copy.getBook().getId(),HoldStatus.WAITING).size());
        });
    }
    @Test void concurrentReturnsPromoteOnlyOneWaitingHold() throws Exception {
        BookCopy copy=copy(); Member borrower=member(), first=member(), second=member();
        var loan=service.borrow(request(copy,borrower));
        holdService.placeHold(copy.getBook().getId(),first.getId(),null,true);
        holdService.placeHold(copy.getBook().getId(),second.getId(),null,true);
        var results=race(() -> service.returnBook(loan.id()), () -> service.returnBook(loan.id()));
        assertEquals(1,results.stream().filter(BusinessRuleException.class::isInstance).count());
        transactions.executeWithoutResult(tx -> {
            var ready=holds.findAllByBookIdAndStatusOrderByPlacedAtAscIdAsc(copy.getBook().getId(),HoldStatus.READY_FOR_PICKUP);
            assertEquals(1,ready.size()); assertEquals(first.getId(),ready.getFirst().getMember().getId());
            assertEquals(copy.getId(),ready.getFirst().getCopy().getId());
            assertEquals(1,holds.findAllByBookIdAndStatusOrderByPlacedAtAscIdAsc(copy.getBook().getId(),HoldStatus.WAITING).size());
        });
        assertEquals(BookCopyStatus.ON_HOLD,copies.findById(copy.getId()).orElseThrow().getStatus());
        assertEquals(0,loans.countByMemberIdAndReturnedOnIsNull(borrower.getId()));
    }
    @Test void outerTransactionFailureRollsBackCheckoutAndInventory() {
        BookCopy copy=copy(); Member member=member();
        assertThrows(IllegalStateException.class, () -> transactions.executeWithoutResult(tx -> {
            service.borrow(request(copy,member));
            throw new IllegalStateException("failure after checkout");
        }));
        assertEquals(0,loans.countByMemberIdAndReturnedOnIsNull(member.getId()));
        assertEquals(BookCopyStatus.AVAILABLE,copies.findById(copy.getId()).orElseThrow().getStatus());
        assertTrue(books.findById(copy.getBook().getId()).orElseThrow().isAvailable());
        assertNotNull(service.borrow(request(copy,member)));
    }
}
