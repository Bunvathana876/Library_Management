package com.library.management.service;

import com.library.management.dto.BorrowRequest;
import com.library.management.dto.HoldResponse;
import com.library.management.dto.LoanResponse;
import com.library.management.exception.BusinessRuleException;
import com.library.management.model.Book;
import com.library.management.model.Hold;
import com.library.management.model.HoldStatus;
import com.library.management.model.Member;
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
class HoldServiceTest {

    @Mock
    private HoldRepository holdRepository;

    @Mock
    private BookRepository bookRepository;

    @Mock
    private MemberRepository memberRepository;

    @Mock
    private LoanRepository loanRepository;

    @Mock
    private MemberService memberService;

    @Mock
    private LoanService loanService;

    @InjectMocks
    private HoldService holdService;

    @Test
    void shouldPlaceHoldOnLoanedBookWithFifoQueuePosition() {
        Book book = new Book("Clean Code", "Robert C. Martin", 2008);
        ReflectionTestUtils.setField(book, "id", 1L);
        book.markBorrowed();

        Member member = new Member("Bob Reader", "bob@example.com");
        ReflectionTestUtils.setField(member, "id", 2L);

        Hold existingFirst = new Hold(book, new Member("First", "first@example.com"), Instant.now().minusSeconds(60));
        ReflectionTestUtils.setField(existingFirst, "id", 10L);

        when(holdRepository.findAllByStatusAndExpiresOnBefore(eq(HoldStatus.READY_FOR_PICKUP), any()))
            .thenReturn(List.of());
        when(bookRepository.findByIdForUpdate(1L)).thenReturn(Optional.of(book));
        when(memberService.ensureMemberForEmail("bob@example.com", null)).thenReturn(member);
        when(holdRepository.existsByBookIdAndStatusIn(eq(1L), anyCollection())).thenReturn(false);
        when(loanRepository.existsByBookIdAndMemberIdAndReturnedOnIsNull(1L, 2L)).thenReturn(false);
        when(holdRepository.existsByBookIdAndMemberIdAndStatusIn(eq(1L), eq(2L), anyCollection())).thenReturn(false);
        when(holdRepository.save(any(Hold.class))).thenAnswer(inv -> {
            Hold h = inv.getArgument(0);
            ReflectionTestUtils.setField(h, "id", 11L);
            return h;
        });
        when(holdRepository.findAllByBookIdAndStatusOrderByPlacedAtAscIdAsc(1L, HoldStatus.WAITING))
            .thenReturn(List.of(existingFirst, new Hold(book, member, Instant.now()) {{
                ReflectionTestUtils.setField(this, "id", 11L);
            }}));

        HoldResponse resp = holdService.placeHold(1L, null, "bob@example.com", false);

        assertEquals(HoldStatus.WAITING, resp.status());
        assertEquals(2, resp.queuePosition());
        assertEquals("Bob Reader", resp.memberName());
    }

    @Test
    void shouldRejectHoldOnAvailableBook() {
        Book book = new Book("Clean Code", "Robert C. Martin", 2008);
        ReflectionTestUtils.setField(book, "id", 1L);
        Member member = new Member("Bob Reader", "bob@example.com");
        ReflectionTestUtils.setField(member, "id", 2L);

        when(holdRepository.findAllByStatusAndExpiresOnBefore(eq(HoldStatus.READY_FOR_PICKUP), any()))
            .thenReturn(List.of());
        when(bookRepository.findByIdForUpdate(1L)).thenReturn(Optional.of(book));
        when(memberService.ensureMemberForEmail("bob@example.com", null)).thenReturn(member);
        when(holdRepository.existsByBookIdAndStatusIn(eq(1L), anyCollection())).thenReturn(false);

        assertThrows(
            BusinessRuleException.class,
            () -> holdService.placeHold(1L, null, "bob@example.com", false)
        );
    }

    @Test
    void shouldPromoteNextWaitingOrReleaseBookWhenCancellingReadyHold() {
        Book book = new Book("DDIA", "Martin Kleppmann", 2017);
        ReflectionTestUtils.setField(book, "id", 1L);
        book.markBorrowed();

        Member holder1 = new Member("Alice", "alice@example.com");
        ReflectionTestUtils.setField(holder1, "id", 2L);
        Member holder2 = new Member("Bob", "bob@example.com");
        ReflectionTestUtils.setField(holder2, "id", 3L);

        Hold readyHold = new Hold(book, holder1, Instant.now().minusSeconds(120));
        ReflectionTestUtils.setField(readyHold, "id", 20L);
        readyHold.markReadyForPickup(Instant.now(), LocalDate.now().plusDays(3));

        Hold nextWaiting = new Hold(book, holder2, Instant.now().minusSeconds(60));
        ReflectionTestUtils.setField(nextWaiting, "id", 21L);

        when(holdRepository.findAllByStatusAndExpiresOnBefore(eq(HoldStatus.READY_FOR_PICKUP), any()))
            .thenReturn(List.of());
        when(holdRepository.findByIdForUpdate(20L)).thenReturn(Optional.of(readyHold));
        when(bookRepository.findByIdForUpdate(1L)).thenReturn(Optional.of(book));
        when(holdRepository.save(any(Hold.class))).thenAnswer(inv -> inv.getArgument(0));
        when(holdRepository.findFirstByBookIdAndStatusOrderByPlacedAtAscIdAsc(1L, HoldStatus.WAITING))
            .thenReturn(Optional.of(nextWaiting));

        HoldResponse cancelled = holdService.cancelHold(20L, "alice@example.com", false);

        assertEquals(HoldStatus.CANCELLED, cancelled.status());
        assertEquals(HoldStatus.READY_FOR_PICKUP, nextWaiting.getStatus());
        assertFalse(book.isAvailable());

        // Now cancel the second ready hold with empty queue -> book returns to available shelf
        when(holdRepository.findByIdForUpdate(21L)).thenReturn(Optional.of(nextWaiting));
        when(holdRepository.findFirstByBookIdAndStatusOrderByPlacedAtAscIdAsc(1L, HoldStatus.WAITING))
            .thenReturn(Optional.empty());
        when(loanRepository.existsByBookIdAndReturnedOnIsNull(1L)).thenReturn(false);

        holdService.cancelHold(21L, "bob@example.com", false);
        assertEquals(HoldStatus.CANCELLED, nextWaiting.getStatus());
        assertTrue(book.isAvailable());
    }

    @Test
    void shouldRejectNonOwnerCancellingHold() {
        Book book = new Book("DDIA", "Martin Kleppmann", 2017);
        Member holder = new Member("Alice", "alice@example.com");
        Hold hold = new Hold(book, holder, Instant.now());

        when(holdRepository.findAllByStatusAndExpiresOnBefore(eq(HoldStatus.READY_FOR_PICKUP), any()))
            .thenReturn(List.of());
        when(holdRepository.findByIdForUpdate(99L)).thenReturn(Optional.of(hold));

        assertThrows(
            ResponseStatusException.class,
            () -> holdService.cancelHold(99L, "intruder@example.com", false)
        );
    }

    @Test
    void shouldFulfillReadyHoldViaLoanService() {
        Book book = new Book("DDIA", "Martin Kleppmann", 2017);
        ReflectionTestUtils.setField(book, "id", 1L);
        Member holder = new Member("Alice", "alice@example.com");
        ReflectionTestUtils.setField(holder, "id", 2L);
        Hold ready = new Hold(book, holder, Instant.now());
        ReflectionTestUtils.setField(ready, "id", 50L);
        ready.markReadyForPickup(Instant.now(), LocalDate.now().plusDays(3));

        when(holdRepository.findAllByStatusAndExpiresOnBefore(eq(HoldStatus.READY_FOR_PICKUP), any()))
            .thenReturn(List.of());
        when(holdRepository.findByIdForUpdate(50L)).thenReturn(Optional.of(ready));
        LoanResponse expected = mock(LoanResponse.class);
        when(loanService.borrow(new BorrowRequest(1L, 2L))).thenReturn(expected);

        LoanResponse actual = holdService.fulfillReadyHold(50L);
        assertSame(expected, actual);
        verify(loanService).borrow(new BorrowRequest(1L, 2L));
    }
}
