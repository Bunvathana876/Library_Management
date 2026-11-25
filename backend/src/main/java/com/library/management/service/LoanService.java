package com.library.management.service;

import com.library.management.config.CirculationPolicyProperties;
import com.library.management.dto.BorrowRequest;
import com.library.management.dto.LoanResponse;
import com.library.management.exception.BookNotFoundException;
import com.library.management.exception.BusinessRuleException;
import com.library.management.exception.ResourceNotFoundException;
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
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
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
    private final BookCopyRepository bookCopyRepository;
    private final NotificationService notificationService;
    private final CirculationPolicyProperties policy;

    public LoanService(
            BookRepository bookRepository,
            MemberRepository memberRepository,
            LoanRepository loanRepository
    ) {
        this(
            bookRepository,
            memberRepository,
            loanRepository,
            null,
            null,
            null,
            CirculationPolicyProperties.defaults()
        );
    }

    public LoanService(
            BookRepository bookRepository,
            MemberRepository memberRepository,
            LoanRepository loanRepository,
            HoldRepository holdRepository
    ) {
        this(
            bookRepository,
            memberRepository,
            loanRepository,
            holdRepository,
            null,
            null,
            CirculationPolicyProperties.defaults()
        );
    }

    @Autowired
    public LoanService(
            BookRepository bookRepository,
            MemberRepository memberRepository,
            LoanRepository loanRepository,
            HoldRepository holdRepository,
            BookCopyRepository bookCopyRepository,
            NotificationService notificationService,
            CirculationPolicyProperties policy
    ) {
        this.bookRepository = bookRepository;
        this.memberRepository = memberRepository;
        this.loanRepository = loanRepository;
        this.holdRepository = holdRepository;
        this.bookCopyRepository = bookCopyRepository;
        this.notificationService = notificationService;
        this.policy = policy != null ? policy : CirculationPolicyProperties.defaults();
    }

    @Transactional
    public LoanResponse borrow(BorrowRequest request) {
        Book book = bookRepository
            .findByIdForUpdate(request.bookId())
            .orElseThrow(() -> new BookNotFoundException(request.bookId()));

        Member member = memberRepository
            .findById(request.memberId())
            .orElseThrow(() -> new ResourceNotFoundException("Member", request.memberId()));

        if (!member.isActive()) {
            throw new BusinessRuleException("Member account is deactivated and cannot borrow books");
        }

        LocalDate today = LocalDate.now();
        Instant now = Instant.now();

        long currentActiveCount = member.getId() != null
            ? loanRepository.countByMemberIdAndReturnedOnIsNull(member.getId())
            : 0L;
        if (currentActiveCount >= policy.getMaxActiveLoans()) {
            throw new BusinessRuleException(
                "Borrowing limit reached (" + currentActiveCount + "/" + policy.getMaxActiveLoans() + " active loans)"
            );
        }

        BigDecimal unpaidFines = member.getId() != null
            ? calculateUnpaidFines(member.getId(), today)
            : BigDecimal.ZERO;
        if (unpaidFines.compareTo(policy.getFineBlockThreshold()) >= 0) {
            throw new BusinessRuleException(
                "Borrowing blocked: unpaid fines ($" + unpaidFines.setScale(2, RoundingMode.HALF_UP)
                    + ") reach the $" + policy.getFineBlockThreshold().setScale(2, RoundingMode.HALF_UP) + " limit"
            );
        }

        if (member.getId() != null
                && loanRepository.existsByBookIdAndMemberIdAndReturnedOnIsNull(book.getId(), member.getId())) {
            throw new BusinessRuleException("Member already has an active loan for this title");
        }

        expireStaleReadyHoldsForBook(book, today, now);

        BookCopy assignedCopy = null;
        List<BookCopy> allCopies = bookCopyRepository != null && book.getId() != null
            ? bookCopyRepository.findAllByBookIdOrderByIdAsc(book.getId())
            : List.of();

        Optional<Hold> memberReadyHold = findMemberReadyHold(book.getId(), member.getId());

        if (memberReadyHold.isPresent()) {
            Hold readyHold = memberReadyHold.get();
            assignedCopy = readyHold.getCopy();
            if (assignedCopy == null && !allCopies.isEmpty()) {
                assignedCopy = allCopies.stream()
                    .filter(c -> c.getStatus() == BookCopyStatus.ON_HOLD || c.getStatus() == BookCopyStatus.AVAILABLE)
                    .findFirst()
                    .orElse(null);
            }
            if (assignedCopy != null && request.copyId() != null && !request.copyId().equals(assignedCopy.getId())) {
                throw new BusinessRuleException(
                    "Pickup hold must be checked out using reserved copy " + assignedCopy.getBarcode()
                );
            }
            readyHold.markFulfilled(now);
            holdRepository.save(readyHold);
        } else if (!allCopies.isEmpty()) {
            if (request.copyId() != null) {
                BookCopy requested = bookCopyRepository
                    .findByIdForUpdate(request.copyId())
                    .orElseThrow(() -> new ResourceNotFoundException("Book copy", request.copyId()));
                if (!requested.getBook().getId().equals(book.getId())) {
                    throw new BusinessRuleException("Selected copy does not belong to this book title");
                }
                if (requested.getStatus() != BookCopyStatus.AVAILABLE) {
                    throw new BusinessRuleException(
                        "Copy " + requested.getBarcode() + " is currently " + requested.getStatus().name()
                    );
                }
                assignedCopy = requested;
            } else {
                assignedCopy = allCopies.stream()
                    .filter(c -> c.getStatus() == BookCopyStatus.AVAILABLE)
                    .findFirst()
                    .orElse(null);
                if (assignedCopy == null) {
                    throwUnavailableOrReservedException(book);
                }
            }
        } else {
            // Single-copy legacy path (unit tests without BookCopy rows)
            Optional<Hold> anyReady = holdRepository != null
                ? holdRepository.findFirstByBookIdAndStatusOrderByPlacedAtAscIdAsc(book.getId(), HoldStatus.READY_FOR_PICKUP)
                : Optional.empty();
            if (anyReady.isPresent()) {
                Hold otherReady = anyReady.get();
                if (!otherReady.getMember().getId().equals(member.getId())) {
                    throw new BusinessRuleException(
                        "This book is currently reserved for " + otherReady.getMember().getFullName() + " at the circulation desk"
                    );
                }
                otherReady.markFulfilled(now);
                holdRepository.save(otherReady);
            } else if (!book.isAvailable()) {
                throw new BusinessRuleException("This book is currently unavailable");
            }
        }

        if (assignedCopy != null) {
            assignedCopy.setStatus(BookCopyStatus.LOANED);
            bookCopyRepository.save(assignedCopy);
            syncBookAvailabilityFromCopies(book, bookCopyRepository.findAllByBookIdOrderByIdAsc(book.getId()));
        } else {
            book.markBorrowed();
        }
        bookRepository.save(book);

        Loan loan = new Loan(
            book,
            assignedCopy,
            member,
            today,
            today.plusDays(14)
        );
        Loan savedLoan = loanRepository.save(loan);

        boolean hasActiveHold = hasActiveHoldOnBook(book.getId());
        boolean memberFineBlocked = isFineBlocked(member.getId(), today);
        return LoanResponse.from(savedLoan, hasActiveHold, null, policy.getDailyFineRate(), memberFineBlocked);
    }

    @Transactional
    public LoanResponse returnBook(Long loanId) {
        Loan loan = loanRepository
            .findByIdForUpdate(loanId)
            .orElseThrow(() -> new ResourceNotFoundException("Loan", loanId));

        if (loan.getReturnedOn() != null) {
            throw new BusinessRuleException("This loan has already been returned");
        }

        Book book = bookRepository
            .findByIdForUpdate(loan.getBook().getId())
            .orElseThrow(() -> new BookNotFoundException(loan.getBook().getId()));

        LocalDate today = LocalDate.now();
        Instant now = Instant.now();
        loan.markReturned(today);

        BigDecimal assessedFine = calculateAccruedFine(loan, today);
        loan.assessFine(assessedFine);

        BookCopy copy = loan.getCopy() != null && bookCopyRepository != null
            ? bookCopyRepository.findByIdForUpdate(loan.getCopy().getId()).orElse(loan.getCopy())
            : null;

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
                if (copy != null) {
                    copy.setStatus(BookCopyStatus.ON_HOLD);
                    bookCopyRepository.save(copy);
                    nextHold.setCopy(copy);
                } else {
                    book.markBorrowed();
                }
                holdRepository.save(nextHold);
                heldForMemberName = nextHold.getMember().getFullName();
                if (notificationService != null) {
                    notificationService.notifyHoldReady(nextHold);
                }
            } else {
                if (copy != null) {
                    copy.setStatus(BookCopyStatus.AVAILABLE);
                    bookCopyRepository.save(copy);
                } else {
                    book.markReturned();
                }
            }
        } else {
            if (copy != null) {
                copy.setStatus(BookCopyStatus.AVAILABLE);
                bookCopyRepository.save(copy);
            } else {
                book.markReturned();
            }
        }

        if (copy != null && bookCopyRepository != null) {
            syncBookAvailabilityFromCopies(book, bookCopyRepository.findAllByBookIdOrderByIdAsc(book.getId()));
        }

        bookRepository.save(book);
        Loan savedLoan = loanRepository.save(loan);

        if (assessedFine.compareTo(BigDecimal.ZERO) > 0 && notificationService != null) {
            notificationService.notifyFineAssessed(savedLoan);
        }

        boolean hasActiveHold = hasActiveHoldOnBook(book.getId());
        boolean memberFineBlocked = isFineBlocked(savedLoan.getMember().getId(), today);
        return LoanResponse.from(
            savedLoan,
            hasActiveHold,
            heldForMemberName,
            policy.getDailyFineRate(),
            memberFineBlocked
        );
    }

    @Transactional
    public LoanResponse renewLoan(Long loanId) {
        Loan loan = loanRepository
            .findByIdForUpdate(loanId)
            .orElseThrow(() -> new ResourceNotFoundException("Loan", loanId));

        return performRenewal(loan);
    }

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

        LocalDate today = LocalDate.now();
        if (loan.getMember() != null && !loan.getMember().isActive()) {
            throw new BusinessRuleException("Deactivated member accounts cannot renew loans");
        }

        if (loan.getMember() != null && loan.getMember().getId() != null && isFineBlocked(loan.getMember().getId(), today)) {
            BigDecimal total = calculateUnpaidFines(loan.getMember().getId(), today);
            throw new BusinessRuleException(
                "Renewal blocked: unpaid fines ($" + total.setScale(2, RoundingMode.HALF_UP)
                    + ") reach the $" + policy.getFineBlockThreshold().setScale(2, RoundingMode.HALF_UP) + " limit"
            );
        }

        if (loan.getRenewalCount() >= Loan.MAX_RENEWALS) {
            throw new BusinessRuleException("This loan has reached the maximum of 2 renewals");
        }

        if (hasActiveHoldOnBook(book.getId())) {
            throw new BusinessRuleException(
                "Cannot renew this loan because another member has an active hold on this book"
            );
        }

        loan.renew(today);
        Loan saved = loanRepository.save(loan);
        return LoanResponse.from(saved, false, null, policy.getDailyFineRate(), false);
    }

    @Transactional(readOnly = true)
    public LoanResponse getLoan(Long id) {
        Loan loan = loanRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Loan", id));

        boolean hasActiveHold = hasActiveHoldOnBook(loan.getBook().getId());
        boolean fineBlocked = loan.getMember() != null && isFineBlocked(loan.getMember().getId(), LocalDate.now());
        return LoanResponse.from(loan, hasActiveHold, null, policy.getDailyFineRate(), fineBlocked);
    }

    @Transactional(readOnly = true)
    public List<LoanResponse> getActiveLoans() {
        Set<Long> booksWithHolds = findBooksWithActiveHolds();
        List<Loan> active = loanRepository.findAllByReturnedOnIsNullOrderByDueOnAsc();
        Map<Long, Boolean> blockedCache = computeBlockedMap(active, LocalDate.now());
        return active.stream()
            .map(loan -> LoanResponse.from(
                loan,
                booksWithHolds.contains(loan.getBook().getId()),
                null,
                policy.getDailyFineRate(),
                blockedCache.getOrDefault(loan.getMember().getId(), false)
            ))
            .toList();
    }

    @Transactional(readOnly = true)
    public List<LoanResponse> getOverdueLoans() {
        Set<Long> booksWithHolds = findBooksWithActiveHolds();
        LocalDate today = LocalDate.now();
        List<Loan> overdue = loanRepository.findAllByReturnedOnIsNullAndDueOnBeforeOrderByDueOnAsc(today);
        Map<Long, Boolean> blockedCache = computeBlockedMap(overdue, today);
        return overdue.stream()
            .map(loan -> LoanResponse.from(
                loan,
                booksWithHolds.contains(loan.getBook().getId()),
                null,
                policy.getDailyFineRate(),
                blockedCache.getOrDefault(loan.getMember().getId(), false)
            ))
            .toList();
    }

    @Transactional(readOnly = true)
    public List<LoanResponse> getFineLoans() {
        LocalDate today = LocalDate.now();
        Set<Long> booksWithHolds = findBooksWithActiveHolds();

        List<Loan> settledOrUnpaidReturned = loanRepository.findAllByFineStatusNotOrderByIdDesc(FineStatus.NONE);
        List<Loan> activeOverdue = loanRepository.findAllByReturnedOnIsNullAndDueOnBeforeOrderByDueOnAsc(today);

        java.util.LinkedHashMap<Long, Loan> combined = new java.util.LinkedHashMap<>();
        for (Loan l : activeOverdue) {
            combined.put(l.getId(), l);
        }
        for (Loan l : settledOrUnpaidReturned) {
            combined.putIfAbsent(l.getId(), l);
        }

        return combined.values().stream()
            .map(loan -> LoanResponse.from(
                loan,
                booksWithHolds.contains(loan.getBook().getId()),
                null,
                policy.getDailyFineRate(),
                isFineBlocked(loan.getMember().getId(), today)
            ))
            .toList();
    }

    @Transactional
    public LoanResponse payFine(Long loanId, String note) {
        return settleFine(loanId, true, note);
    }

    @Transactional
    public LoanResponse waiveFine(Long loanId, String note) {
        return settleFine(loanId, false, note);
    }

    private LoanResponse settleFine(Long loanId, boolean paid, String note) {
        Loan loan = loanRepository
            .findByIdForUpdate(loanId)
            .orElseThrow(() -> new ResourceNotFoundException("Loan", loanId));

        if (loan.getReturnedOn() == null) {
            throw new BusinessRuleException("Return the overdue book first before settling its fine");
        }
        if (loan.getFineStatus() != FineStatus.UNPAID || loan.getFineAmount().compareTo(BigDecimal.ZERO) <= 0) {
            throw new BusinessRuleException("This loan does not have an unpaid fine");
        }

        if (paid) {
            loan.markFinePaid(Instant.now(), note);
        } else {
            loan.markFineWaived(Instant.now(), note);
        }

        Loan saved = loanRepository.save(loan);
        boolean hasHold = hasActiveHoldOnBook(saved.getBook().getId());
        boolean fineBlocked = isFineBlocked(saved.getMember().getId(), LocalDate.now());
        return LoanResponse.from(saved, hasHold, null, policy.getDailyFineRate(), fineBlocked);
    }

    @Transactional(readOnly = true)
    public BigDecimal calculateUnpaidFines(Long memberId, LocalDate today) {
        if (memberId == null) {
            return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        }
        BigDecimal total = BigDecimal.ZERO;
        List<Loan> unpaidReturned = loanRepository.findAllByMemberIdAndFineStatus(memberId, FineStatus.UNPAID);
        for (Loan l : unpaidReturned) {
            if (l.getFineAmount() != null) {
                total = total.add(l.getFineAmount());
            }
        }
        List<Loan> activeLoans = loanRepository.findAllByMemberIdAndReturnedOnIsNullOrderByDueOnAsc(memberId);
        for (Loan l : activeLoans) {
            if (l.getDueOn() != null && l.getDueOn().isBefore(today)) {
                total = total.add(calculateAccruedFine(l, today));
            }
        }
        return total.setScale(2, RoundingMode.HALF_UP);
    }

    public boolean isFineBlocked(Long memberId, LocalDate today) {
        if (memberId == null) {
            return false;
        }
        return calculateUnpaidFines(memberId, today).compareTo(policy.getFineBlockThreshold()) >= 0;
    }

    public BigDecimal calculateAccruedFine(Loan loan, LocalDate referenceDate) {
        if (loan == null || loan.getDueOn() == null || referenceDate == null || !loan.getDueOn().isBefore(referenceDate)) {
            return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        }
        long overdueDays = ChronoUnit.DAYS.between(loan.getDueOn(), referenceDate);
        return policy.getDailyFineRate()
            .multiply(BigDecimal.valueOf(Math.max(0, overdueDays)))
            .setScale(2, RoundingMode.HALF_UP);
    }

    public CirculationPolicyProperties getPolicy() {
        return policy;
    }

    private Optional<Hold> findMemberReadyHold(Long bookId, Long memberId) {
        if (holdRepository == null || bookId == null || memberId == null) {
            return Optional.empty();
        }
        List<Hold> matches = holdRepository.findAllByBookIdAndMemberIdAndStatusOrderByPlacedAtAscIdAsc(
            bookId,
            memberId,
            HoldStatus.READY_FOR_PICKUP
        );
        return matches.isEmpty() ? Optional.empty() : Optional.of(matches.get(0));
    }

    private void expireStaleReadyHoldsForBook(Book book, LocalDate today, Instant now) {
        if (holdRepository == null || book.getId() == null) {
            return;
        }
        List<Hold> readyHolds = holdRepository.findAllByBookIdAndStatusOrderByPlacedAtAscIdAsc(
            book.getId(),
            HoldStatus.READY_FOR_PICKUP
        );
        for (Hold ready : readyHolds) {
            if (ready.getExpiresOn() != null && ready.getExpiresOn().isBefore(today)) {
                ready.markExpired();
                BookCopy freedCopy = ready.getCopy();
                holdRepository.save(ready);
                if (notificationService != null) {
                    notificationService.notifyHoldExpired(ready);
                }

                Optional<Hold> nextWaiting = holdRepository.findFirstByBookIdAndStatusOrderByPlacedAtAscIdAsc(
                    book.getId(),
                    HoldStatus.WAITING
                );
                if (nextWaiting.isPresent()) {
                    Hold promoted = nextWaiting.get();
                    promoted.markReadyForPickup(now, today.plusDays(Hold.PICKUP_WINDOW_DAYS));
                    if (freedCopy != null) {
                        promoted.setCopy(freedCopy);
                    }
                    holdRepository.save(promoted);
                    if (notificationService != null) {
                        notificationService.notifyHoldReady(promoted);
                    }
                } else if (freedCopy != null && bookCopyRepository != null) {
                    freedCopy.setStatus(BookCopyStatus.AVAILABLE);
                    bookCopyRepository.save(freedCopy);
                    syncBookAvailabilityFromCopies(book, bookCopyRepository.findAllByBookIdOrderByIdAsc(book.getId()));
                } else if (!loanRepository.existsByBookIdAndReturnedOnIsNull(book.getId())) {
                    book.markReturned();
                }
            }
        }
    }

    private void throwUnavailableOrReservedException(Book book) {
        if (holdRepository != null && book.getId() != null) {
            Optional<Hold> otherReady = holdRepository.findFirstByBookIdAndStatusOrderByPlacedAtAscIdAsc(
                book.getId(),
                HoldStatus.READY_FOR_PICKUP
            );
            if (otherReady.isPresent()) {
                throw new BusinessRuleException(
                    "This book is currently reserved for "
                        + otherReady.get().getMember().getFullName()
                        + " at the circulation desk"
                );
            }
        }
        throw new BusinessRuleException("This book is currently unavailable");
    }

    private void syncBookAvailabilityFromCopies(Book book, List<BookCopy> copies) {
        if (copies == null || copies.isEmpty()) {
            return;
        }
        boolean anyAvail = copies.stream().anyMatch(c -> c.getStatus() == BookCopyStatus.AVAILABLE);
        book.setAvailable(anyAvail);
    }

    private Map<Long, Boolean> computeBlockedMap(List<Loan> loans, LocalDate today) {
        Map<Long, Boolean> map = new HashMap<>();
        for (Loan l : loans) {
            if (l.getMember() != null && l.getMember().getId() != null) {
                map.computeIfAbsent(l.getMember().getId(), id -> isFineBlocked(id, today));
            }
        }
        return map;
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
