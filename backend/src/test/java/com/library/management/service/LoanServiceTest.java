
package com.library.management.service;

import com.library.management.dto.BorrowRequest;
import com.library.management.dto.LoanResponse;
import com.library.management.exception.BusinessRuleException;
import com.library.management.model.Book;
import com.library.management.model.Loan;
import com.library.management.model.Member;
import com.library.management.repository.BookRepository;
import com.library.management.repository.LoanRepository;
import com.library.management.repository.MemberRepository;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class LoanServiceTest {

    @Mock
    private BookRepository bookRepository;

    @Mock
    private MemberRepository memberRepository;

    @Mock
    private LoanRepository loanRepository;

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

        book.markBorrowed();

        when(bookRepository.findByIdForUpdate(1L))
            .thenReturn(Optional.of(book));

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
}
