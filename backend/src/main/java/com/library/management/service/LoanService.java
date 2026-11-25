package com.library.management.service;

import com.library.management.dto.BorrowRequest;
import com.library.management.dto.LoanResponse;

import com.library.management.exception.BookNotFoundException;
import com.library.management.exception.BusinessRuleException;
import com.library.management.exception.ResourceNotFoundException;

import com.library.management.model.Book;
import com.library.management.model.Hold;
import com.library.management.model.HoldStatus;
import com.library.management.model.Loan;
import com.library.management.model.Member;

import com.library.management.repository.BookRepository;
import com.library.management.repository.HoldRepository;
import com.library.management.repository.LoanRepository;
import com.library.management.repository.MemberRepository;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.Set;

@Service
public class LoanService {

    public static final List<HoldStatus> ACTIVE_HOLD_STATUSES =
        List.of(HoldStatus.WAITING, HoldStatus.READY_FOR_PICKUP);

    private final BookRepository bookRepository;
    private final MemberRepository memberRepository;
    private final LoanRepository loanRepository;
    private final HoldRepository holdRepository;

    public LoanService(
            BookRepository bookRepository,
            MemberRepository memberRepository,
            LoanRepository loanRepository
    ) {
        this(bookRepository, memberRepository, loanRepository, null);
    }

    @Autowired
    public LoanService(
            BookRepository bookRepository,
            MemberRepository memberRepository,
            LoanRepository loanRepository,
            HoldRepository holdRepository
    ) {
        this.bookRepository = bookRepository;
        this.memberRepository = memberRepository;
        this.loanRepository = loanRepository;
        this.holdRepository = holdRepository;
    }

    // BORROW BOOK
    @Transactional
    public LoanResponse borrow(BorrowRequest request) {

        Book book = bookRepository
            .findByIdForUpdate(request.bookId())
            .orElseThrow(() ->
                new BookNotFoundException(request.bookId())
            );

        Member member = memberRepository
            .findById(request.memberId())
            .orElseThrow(() ->
                new ResourceNotFoundException(
                    "Member", request.memberId()
                )
            );

        LocalDate today = LocalDate.now();
        Instant now = Instant.now();

        Optional<Hold> readyHoldOpt = resolveActiveReadyHold(book, today, now);

        if (readyHoldOpt.isPresent()) {
            Hold readyHold = readyHoldOpt.get();
            if (!readyHold.getMember().getId().equals(member.getId())) {
                throw new BusinessRuleException(
                    "This book is currently reserved for "
                        + readyHold.getMember().getFullName()
                        + " at the circulation desk"
                );
            }
            readyHold.markFulfilled(now);
            holdRepository.save(readyHold);
        } else if (!book.isAvailable()) {
            throw new BusinessRuleException(
                "This book is currently unavailable"
            );
        }

        Loan loan = new Loan(
            book,
            member,
            today,
            today.plusDays(14)
        );

        book.markBorrowed();
        bookRepository.save(book);

        Loan savedLoan = loanRepository.save(loan);
        boolean hasActiveHold = hasActiveHoldOnBook(book.getId());

        return LoanResponse.from(savedLoan, hasActiveHold);
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

        LocalDate today = LocalDate.now();
        Instant now = Instant.now();
        loan.markReturned(today);

        String heldForMemberName = null;
        if (holdRepository != null) {
            Optional<Hold> nextWaitingOpt = holdRepository
                .findFirstByBookIdAndStatusOrderByPlacedAtAscIdAsc(
                    book.getId(),
                    HoldStatus.WAITING
                );
            if (nextWaitingOpt.isPresent()) {
                Hold nextHold = nextWaitingOpt.get();
                nextHold.markReadyForPickup(now, today.plusDays(Hold.PICKUP_WINDOW_DAYS));
                holdRepository.save(nextHold);
                book.markBorrowed();
                heldForMemberName = nextHold.getMember().getFullName();
            } else {
                book.markReturned();
            }
        } else {
            book.markReturned();
        }

        bookRepository.save(book);
        Loan savedLoan = loanRepository.save(loan);
        boolean hasActiveHold = hasActiveHoldOnBook(book.getId());

        return LoanResponse.from(savedLoan, hasActiveHold, heldForMemberName);
    }

    // STAFF RENEW LOAN (+14 DAYS)
    @Transactional
    public LoanResponse renewLoan(Long loanId) {
        Loan loan = loanRepository
            .findByIdForUpdate(loanId)
            .orElseThrow(() -> new ResourceNotFoundException("Loan", loanId));

        return performRenewal(loan);
    }

    // MEMBER SELF-SERVICE RENEW LOAN (+14 DAYS)
    @Transactional
    public LoanResponse renewOwnLoan(Long loanId, String memberEmail) {
        Loan loan = loanRepository
            .findByIdForUpdate(loanId)
            .orElseThrow(() -> new ResourceNotFoundException("Loan", loanId));

        if (memberEmail == null
                || !loan.getMember().getEmail().equalsIgnoreCase(memberEmail.trim())) {
            throw new ResponseStatusException(
                HttpStatus.FORBIDDEN,
                "You can only renew your own loans"
            );
        }

        return performRenewal(loan);
    }

    private LoanResponse performRenewal(Loan loan) {
        Book book = bookRepository
            .findByIdForUpdate(loan.getBook().getId())
            .orElseThrow(() -> new BookNotFoundException(loan.getBook().getId()));

        if (loan.getReturnedOn() != null) {
            throw new BusinessRuleException("Returned loans cannot be renewed");
        }

        if (loan.getRenewalCount() >= Loan.MAX_RENEWALS) {
            throw new BusinessRuleException("This loan has reached the maximum of 2 renewals");
        }

        if (hasActiveHoldOnBook(book.getId())) {
            throw new BusinessRuleException(
                "Cannot renew this loan because another member has an active hold on this book"
            );
        }

        loan.renew(LocalDate.now());
        Loan saved = loanRepository.save(loan);
        return LoanResponse.from(saved, false);
    }

    // GET ONE LOAN
    @Transactional(readOnly = true)
    public LoanResponse getLoan(Long id) {

        Loan loan = loanRepository.findById(id)
            .orElseThrow(() ->
                new ResourceNotFoundException("Loan", id)
            );

        boolean hasActiveHold = hasActiveHoldOnBook(loan.getBook().getId());
        return LoanResponse.from(loan, hasActiveHold);
    }

    // GET ACTIVE LOANS
    @Transactional(readOnly = true)
    public List<LoanResponse> getActiveLoans() {
        Set<Long> booksWithHolds = findBooksWithActiveHolds();
        return loanRepository
            .findAllByReturnedOnIsNullOrderByDueOnAsc()
            .stream()
            .map(loan -> LoanResponse.from(loan, booksWithHolds.contains(loan.getBook().getId())))
            .toList();
    }

    // GET OVERDUE LOANS
    @Transactional(readOnly = true)
    public List<LoanResponse> getOverdueLoans() {
        Set<Long> booksWithHolds = findBooksWithActiveHolds();
        return loanRepository
            .findAllByReturnedOnIsNullAndDueOnBeforeOrderByDueOnAsc(
                LocalDate.now()
            )
            .stream()
            .map(loan -> LoanResponse.from(loan, booksWithHolds.contains(loan.getBook().getId())))
            .toList();
    }

    private Optional<Hold> resolveActiveReadyHold(Book book, LocalDate today, Instant now) {
        if (holdRepository == null) {
            return Optional.empty();
        }
        Optional<Hold> readyOpt = holdRepository.findFirstByBookIdAndStatusOrderByPlacedAtAscIdAsc(
            book.getId(),
            HoldStatus.READY_FOR_PICKUP
        );
        if (readyOpt.isEmpty()) {
            return Optional.empty();
        }
        Hold ready = readyOpt.get();
        if (ready.getExpiresOn() != null && ready.getExpiresOn().isBefore(today)) {
            ready.markExpired();
            holdRepository.save(ready);

            Optional<Hold> nextWaiting = holdRepository.findFirstByBookIdAndStatusOrderByPlacedAtAscIdAsc(
                book.getId(),
                HoldStatus.WAITING
            );
            if (nextWaiting.isPresent()) {
                Hold promoted = nextWaiting.get();
                promoted.markReadyForPickup(now, today.plusDays(Hold.PICKUP_WINDOW_DAYS));
                holdRepository.save(promoted);
                return Optional.of(promoted);
            }
            if (!loanRepository.existsByBookIdAndReturnedOnIsNull(book.getId())) {
                book.markReturned();
            }
            return Optional.empty();
        }
        return readyOpt;
    }

    private boolean hasActiveHoldOnBook(Long bookId) {
        if (holdRepository == null || bookId == null) {
            return false;
        }
        return holdRepository.existsByBookIdAndStatusIn(bookId, ACTIVE_HOLD_STATUSES);
    }

    private Set<Long> findBooksWithActiveHolds() {
        if (holdRepository == null) {
            return Set.of();
        }
        return holdRepository.findBookIdsByStatusIn(ACTIVE_HOLD_STATUSES);
    }
}
