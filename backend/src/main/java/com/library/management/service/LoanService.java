package com.library.management.service;

import com.library.management.dto.BorrowRequest;
import com.library.management.dto.LoanResponse;

import com.library.management.exception.BookNotFoundException;
import com.library.management.exception.BusinessRuleException;
import com.library.management.exception.ResourceNotFoundException;

import com.library.management.model.Book;
import com.library.management.model.Loan;
import com.library.management.model.Member;

import com.library.management.repository.BookRepository;
import com.library.management.repository.LoanRepository;
import com.library.management.repository.MemberRepository;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

@Service
public class LoanService {
    
    private final BookRepository bookRepository;
    private final MemberRepository memberRepository;
    private final LoanRepository loanRepository;

    public LoanService(
            BookRepository bookRepository,
            MemberRepository memberRepository,
            LoanRepository loanRepository
    ) {
        this.bookRepository = bookRepository;
        this.memberRepository = memberRepository;
        this.loanRepository = loanRepository;
    }

    // BORROW BOOK
    @Transactional
    public LoanResponse borrow(BorrowRequest request) {

        Book book = bookRepository
            .findByIdForUpdate(request.bookId())
            .orElseThrow(() ->
                new BookNotFoundException(request.bookId())
            );

        if (!book.isAvailable()) {
            throw new BusinessRuleException(
                "This book is currently unavailable"
            );
        }

        Member member = memberRepository
            .findById(request.memberId())
            .orElseThrow(() ->
                new ResourceNotFoundException(
                    "Member", request.memberId()
                )
            );

        LocalDate today = LocalDate.now();

        Loan loan = new Loan(
            book,
            member,
            today,
            today.plusDays(14)
        );

        book.markBorrowed();
        bookRepository.save(book);

        Loan savedLoan = loanRepository.save(loan);

        return LoanResponse.from(savedLoan);
    }

    // RETURN BOOK
    @Transactional
    public LoanResponse returnBook(Long loanId) {

        Loan loan = loanRepository
            .findByIdForUpdate(loanId)
            .orElseThrow(() ->
                new ResourceNotFoundException(
                    "Loan", loanId
                )
            );

        if (loan.getReturnedOn() != null) {
            throw new BusinessRuleException(
                "This loan has already been returned"
            );
        }

        Book book = bookRepository
            .findByIdForUpdate(loan.getBook().getId())
            .orElseThrow(() ->
                new BookNotFoundException(
                    loan.getBook().getId()
                )
            );

        loan.markReturned(LocalDate.now());
        book.markReturned();

        bookRepository.save(book);
        Loan savedLoan = loanRepository.save(loan);

        return LoanResponse.from(savedLoan);
    }

    // GET ONE LOAN
    @Transactional(readOnly = true)
    public LoanResponse getLoan(Long id) {

        Loan loan = loanRepository.findById(id)
            .orElseThrow(() ->
                new ResourceNotFoundException("Loan", id)
            );

        return LoanResponse.from(loan);
    }

    // GET ACTIVE LOANS
    @Transactional(readOnly = true)
    public List<LoanResponse> getActiveLoans() {

        return loanRepository
            .findAllByReturnedOnIsNullOrderByDueOnAsc()
            .stream()
            .map(LoanResponse::from)
            .toList();
    }

    // GET OVERDUE LOANS
    @Transactional(readOnly = true)
    public List<LoanResponse> getOverdueLoans() {

        return loanRepository
            .findAllByReturnedOnIsNullAndDueOnBeforeOrderByDueOnAsc(
                LocalDate.now()
            )
            .stream()
            .map(LoanResponse::from)
            .toList();
    }
}
