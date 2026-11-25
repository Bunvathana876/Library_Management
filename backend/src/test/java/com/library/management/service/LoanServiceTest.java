
package com.library.management.service;

import com.library.management.config.CirculationPolicyProperties;
import com.library.management.dto.BorrowRequest;
import com.library.management.dto.LoanResponse;
import com.library.management.exception.BusinessRuleException;
import com.library.management.model.Book;
import com.library.management.model.BookCopy;
import com.library.management.model.BookCopyStatus;
import com.library.management.model.FineStatus;
import com.library.management.model.Hold;
import com.library.management.model.HoldStatus;
import com.library.management.model.Loan;
import com.library.management.model.Member;
import com.library.management.repository.BookCopyRepository;
import com.library.management.repository.BookRepository;
import com.library.management.repository.HoldRepository;
import com.library.management.repository.LoanRepository;
import com.library.management.repository.MemberRepository;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class LoanServiceTest {

    @Mock
    private BookRepository bookRepository;

    @Mock
    private MemberRepository memberRepository;

    @Mock
    private LoanRepository loanRepository;

    @Mock
    private HoldRepository holdRepository;

    @InjectMocks
    private LoanService loanService;

    @Test
    void shouldBorrowAvailableBook() {

        Book book = new Book(
            "Spring Boot", "Example Author", 2025
        );

        Member member = new Member(
            "Dara", "dara@example.com"
        );

        when(bookRepository.findByIdForUpdate(1L))
            .thenReturn(Optional.of(book));

        when(memberRepository.findById(2L))
            .thenReturn(Optional.of(member));

        when(loanRepository.save(any(Loan.class)))
            .thenAnswer(invocation ->
                invocation.getArgument(0)
            );

        LoanResponse result = loanService.borrow(
            new BorrowRequest(1L, 2L)
        );

        assertFalse(book.isAvailable());
        assertEquals("Spring Boot", result.bookTitle());
        verify(loanRepository).save(any(Loan.class));
    }

    @Test
    void shouldRejectUnavailableBook() {

        Book book = new Book(
            "Clean Code", "Robert C. Martin", 2008
        );
        ReflectionTestUtils.setField(book, "id", 1L);

        book.markBorrowed();

        when(bookRepository.findByIdForUpdate(1L))
            .thenReturn(Optional.of(book));
        when(memberRepository.findById(2L))
            .thenReturn(Optional.of(new Member("Dara", "dara@example.com")));
        when(holdRepository.findFirstByBookIdAndStatusOrderByPlacedAtAscIdAsc(1L, HoldStatus.READY_FOR_PICKUP))
            .thenReturn(Optional.empty());

        assertThrows(
            BusinessRuleException.class,
            () -> loanService.borrow(
                new BorrowRequest(1L, 2L)
            )
        );

        verifyNoInteractions(loanRepository);
    }

    @Test
    void shouldRejectReturningAlreadyReturnedLoan() {

        Book book = new Book(
            "Effective Java", "Joshua Bloch", 2018
        );

        Member member = new Member(
            "Dara", "dara@example.com"
        );

        LocalDate today = LocalDate.now();

        Loan loan = new Loan(
            book, member, today, today.plusDays(14)
        );

        loan.markReturned(today);

        when(loanRepository.findByIdForUpdate(5L))
            .thenReturn(Optional.of(loan));

        assertThrows(
            BusinessRuleException.class,
            () -> loanService.returnBook(5L)
        );
    }

    @Test
    void shouldRenewLoanUpToTwoTimesAndRejectThird() {
        Book book = new Book("Clean Code", "Robert C. Martin", 2008);
        ReflectionTestUtils.setField(book, "id", 1L);
        Member member = new Member("Dara", "dara@example.com");
        ReflectionTestUtils.setField(member, "id", 2L);

        LocalDate today = LocalDate.now();
        Loan loan = new Loan(book, member, today, today.plusDays(14));
        ReflectionTestUtils.setField(loan, "id", 10L);

        when(loanRepository.findByIdForUpdate(10L)).thenReturn(Optional.of(loan));
        when(bookRepository.findByIdForUpdate(1L)).thenReturn(Optional.of(book));
        when(holdRepository.existsByBookIdAndStatusIn(eq(1L), anyCollection())).thenReturn(false);
        when(loanRepository.save(any(Loan.class))).thenAnswer(inv -> inv.getArgument(0));

        LoanResponse first = loanService.renewLoan(10L);
        assertEquals(1, first.renewalCount());
        assertEquals(today.plusDays(28), first.dueOn());
        assertTrue(first.renewable());

        LoanResponse second = loanService.renewLoan(10L);
        assertEquals(2, second.renewalCount());
        assertEquals(today.plusDays(42), second.dueOn());
        assertFalse(second.renewable());
        assertEquals("Maximum 2 renewals reached", second.renewDisabledReason());

        assertThrows(BusinessRuleException.class, () -> loanService.renewLoan(10L));
    }

    @Test
    void shouldRejectRenewalWhenActiveHoldExists() {
        Book book = new Book("DDIA", "Martin Kleppmann", 2017);
        ReflectionTestUtils.setField(book, "id", 1L);
        Member member = new Member("Dara", "dara@example.com");
        LocalDate today = LocalDate.now();
        Loan loan = new Loan(book, member, today, today.plusDays(14));
        ReflectionTestUtils.setField(loan, "id", 11L);

        when(loanRepository.findByIdForUpdate(11L)).thenReturn(Optional.of(loan));
        when(bookRepository.findByIdForUpdate(1L)).thenReturn(Optional.of(book));
        when(holdRepository.existsByBookIdAndStatusIn(eq(1L), anyCollection())).thenReturn(true);

        BusinessRuleException ex = assertThrows(
            BusinessRuleException.class,
            () -> loanService.renewOwnLoan(11L, "dara@example.com")
        );
        assertTrue(ex.getMessage().contains("active hold"));
    }

    @Test
    void shouldRejectOwnRenewalWhenLoanBelongsToAnotherMember() {
        Book book = new Book("DDIA", "Martin Kleppmann", 2017);
        Member member = new Member("Dara", "dara@example.com");
        Loan loan = new Loan(book, member, LocalDate.now(), LocalDate.now().plusDays(14));

        when(loanRepository.findByIdForUpdate(12L)).thenReturn(Optional.of(loan));

        assertThrows(
            ResponseStatusException.class,
            () -> loanService.renewOwnLoan(12L, "other@example.com")
        );
    }

    @Test
    void shouldPromoteWaitingHoldWhenReturningBookAndFulfillOnHolderBorrow() {
        Book book = new Book("Clean Code", "Robert C. Martin", 2008);
        ReflectionTestUtils.setField(book, "id", 1L);
        book.markBorrowed();

        Member borrower = new Member("Alice", "alice@example.com");
        ReflectionTestUtils.setField(borrower, "id", 2L);

        Member holder = new Member("Bob", "bob@example.com");
        ReflectionTestUtils.setField(holder, "id", 3L);

        LocalDate today = LocalDate.now();
        Loan loan = new Loan(book, borrower, today.minusDays(5), today.plusDays(9));
        ReflectionTestUtils.setField(loan, "id", 20L);

        Hold waitingHold = new Hold(book, holder, Instant.now());
        ReflectionTestUtils.setField(waitingHold, "id", 30L);

        when(loanRepository.findByIdForUpdate(20L)).thenReturn(Optional.of(loan));
        when(bookRepository.findByIdForUpdate(1L)).thenReturn(Optional.of(book));
        when(holdRepository.findFirstByBookIdAndStatusOrderByPlacedAtAscIdAsc(1L, HoldStatus.WAITING))
            .thenReturn(Optional.of(waitingHold));
        when(holdRepository.existsByBookIdAndStatusIn(eq(1L), anyCollection())).thenReturn(true);
        when(loanRepository.save(any(Loan.class))).thenAnswer(inv -> inv.getArgument(0));

        LoanResponse returnResp = loanService.returnBook(20L);

        assertFalse(book.isAvailable());
        assertEquals(HoldStatus.READY_FOR_PICKUP, waitingHold.getStatus());
        assertEquals("Bob", returnResp.heldForMemberName());
        verify(holdRepository).save(waitingHold);

        // Other member cannot borrow reserved book
        when(memberRepository.findById(2L)).thenReturn(Optional.of(borrower));
        when(holdRepository.findFirstByBookIdAndStatusOrderByPlacedAtAscIdAsc(1L, HoldStatus.READY_FOR_PICKUP))
            .thenReturn(Optional.of(waitingHold));

        assertThrows(BusinessRuleException.class, () -> loanService.borrow(new BorrowRequest(1L, 2L)));

        // Ready holder CAN borrow and fulfills the hold
        when(memberRepository.findById(3L)).thenReturn(Optional.of(holder));
        LoanResponse fulfilledBorrow = loanService.borrow(new BorrowRequest(1L, 3L));
        assertEquals(HoldStatus.FULFILLED, waitingHold.getStatus());
        assertEquals("Bob", fulfilledBorrow.memberName());
    }

    @Test
    void shouldRejectBorrowWhenActiveLoanLimitOrFineThresholdReached() {
        Book book = new Book("DDIA", "Martin Kleppmann", 2017);
        ReflectionTestUtils.setField(book, "id", 1L);
        Member member = new Member("Alice", "alice@example.com");
        ReflectionTestUtils.setField(member, "id", 2L);

        when(bookRepository.findByIdForUpdate(1L)).thenReturn(Optional.of(book));
        when(memberRepository.findById(2L)).thenReturn(Optional.of(member));
        when(loanRepository.countByMemberIdAndReturnedOnIsNull(2L)).thenReturn(5L);

        BusinessRuleException limitEx = assertThrows(
            BusinessRuleException.class,
            () -> loanService.borrow(new BorrowRequest(1L, 2L))
        );
        assertTrue(limitEx.getMessage().contains("limit"));

        // Below limit, but unpaid fines exceed $10.00 threshold
        when(loanRepository.countByMemberIdAndReturnedOnIsNull(2L)).thenReturn(1L);
        Loan unpaidLoan = new Loan(book, member, LocalDate.now().minusDays(30), LocalDate.now().minusDays(16));
        unpaidLoan.markReturned(LocalDate.now().minusDays(1));
        unpaidLoan.assessFine(new BigDecimal("12.00"));
        when(loanRepository.findAllByMemberIdAndFineStatus(2L, FineStatus.UNPAID))
            .thenReturn(List.of(unpaidLoan));

        BusinessRuleException fineEx = assertThrows(
            BusinessRuleException.class,
            () -> loanService.borrow(new BorrowRequest(1L, 2L))
        );
        assertTrue(fineEx.getMessage().contains("unpaid fines"));
    }

    @Test
    void shouldAssessOverdueFineOnReturnAndSupportPayOrWaiveAndMultiCopyBorrow() {
        BookCopyRepository copyRepo = mock(BookCopyRepository.class);
        NotificationService notifService = mock(NotificationService.class);
        CirculationPolicyProperties policy = new CirculationPolicyProperties(
            5, new BigDecimal("0.50"), new BigDecimal("10.00"), 2
        );
        LoanService fullService = new LoanService(
            bookRepository,
            memberRepository,
            loanRepository,
            holdRepository,
            copyRepo,
            notifService,
            policy
        );

        Book book = new Book("DDIA", "Martin Kleppmann", 2017);
        ReflectionTestUtils.setField(book, "id", 1L);
        BookCopy copy1 = new BookCopy(book, "CPY-0001-01", BookCopyStatus.AVAILABLE, "CS-A", null);
        ReflectionTestUtils.setField(copy1, "id", 101L);
        BookCopy copy2 = new BookCopy(book, "CPY-0001-02", BookCopyStatus.AVAILABLE, "CS-A", null);
        ReflectionTestUtils.setField(copy2, "id", 102L);

        Member alice = new Member("Alice", "alice@example.com");
        ReflectionTestUtils.setField(alice, "id", 2L);

        when(bookRepository.findByIdForUpdate(1L)).thenReturn(Optional.of(book));
        when(memberRepository.findById(2L)).thenReturn(Optional.of(alice));
        when(copyRepo.findAllByBookIdOrderByIdAsc(1L)).thenReturn(List.of(copy1, copy2));
        when(loanRepository.save(any(Loan.class))).thenAnswer(inv -> inv.getArgument(0));

        LoanResponse borrowed = fullService.borrow(new BorrowRequest(1L, 2L));
        assertEquals("CPY-0001-01", borrowed.copyBarcode());
        assertEquals(BookCopyStatus.LOANED, copy1.getStatus());

        // Simulate 4 days overdue return -> $2.00 UNPAID fine
        Loan overdueLoan = new Loan(book, copy1, alice, LocalDate.now().minusDays(18), LocalDate.now().minusDays(4));
        ReflectionTestUtils.setField(overdueLoan, "id", 55L);
        when(loanRepository.findByIdForUpdate(55L)).thenReturn(Optional.of(overdueLoan));
        when(copyRepo.findByIdForUpdate(101L)).thenReturn(Optional.of(copy1));
        when(holdRepository.findFirstByBookIdAndStatusOrderByPlacedAtAscIdAsc(1L, HoldStatus.WAITING))
            .thenReturn(Optional.empty());

        LoanResponse returned = fullService.returnBook(55L);
        assertEquals(new BigDecimal("2.00"), returned.fineAmount());
        assertEquals(FineStatus.UNPAID, returned.fineStatus());
        assertEquals(BookCopyStatus.AVAILABLE, copy1.getStatus());
        verify(notifService).notifyFineAssessed(overdueLoan);

        LoanResponse paid = fullService.payFine(55L, "Cash receipt");
        assertEquals(FineStatus.PAID, paid.fineStatus());
        assertEquals("Cash receipt", paid.fineNote());
    }
}
