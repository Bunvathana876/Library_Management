package com.library.management.service;

import com.library.management.config.CirculationPolicyProperties;
import com.library.management.dto.BorrowRequest;
import com.library.management.dto.HoldResponse;
import com.library.management.dto.LoanResponse;
import com.library.management.dto.MemberBookshelfResponse;
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
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

@Service
public class HoldService {

    public static final List<HoldStatus> ACTIVE_STATUSES =
        List.of(HoldStatus.WAITING, HoldStatus.READY_FOR_PICKUP);

    public static final List<HoldStatus> PAST_STATUSES =
        List.of(HoldStatus.FULFILLED, HoldStatus.CANCELLED, HoldStatus.EXPIRED);

    private final HoldRepository holdRepository;
    private final BookRepository bookRepository;
    private final MemberRepository memberRepository;
    private final LoanRepository loanRepository;
    private final MemberService memberService;
    private final LoanService loanService;
    private final BookCopyRepository bookCopyRepository;
    private final NotificationService notificationService;
    private final CirculationPolicyProperties policy;

    public HoldService(
            HoldRepository holdRepository,
            BookRepository bookRepository,
            MemberRepository memberRepository,
            LoanRepository loanRepository,
            MemberService memberService,
            LoanService loanService
    ) {
        this(
            holdRepository,
            bookRepository,
            memberRepository,
            loanRepository,
            memberService,
            loanService,
            null,
            null,
            CirculationPolicyProperties.defaults()
        );
    }

    @Autowired
    public HoldService(
            HoldRepository holdRepository,
            BookRepository bookRepository,
            MemberRepository memberRepository,
            LoanRepository loanRepository,
            MemberService memberService,
            LoanService loanService,
            BookCopyRepository bookCopyRepository,
            NotificationService notificationService,
            CirculationPolicyProperties policy
    ) {
        this.holdRepository = holdRepository;
        this.bookRepository = bookRepository;
        this.memberRepository = memberRepository;
        this.loanRepository = loanRepository;
        this.memberService = memberService;
        this.loanService = loanService;
        this.bookCopyRepository = bookCopyRepository;
        this.notificationService = notificationService;
        this.policy = policy != null ? policy : CirculationPolicyProperties.defaults();
    }

    @Transactional
    public HoldResponse placeHold(
            Long bookId,
            Long requestedMemberId,
            String actorEmail,
            boolean isStaff
    ) {
        Member member;
        if (isStaff && requestedMemberId != null) {
            member = memberRepository
                .findById(requestedMemberId)
                .orElseThrow(() -> new ResourceNotFoundException("Member", requestedMemberId));
        } else {
            member = memberService.ensureMemberForEmail(actorEmail, null);
        }

        Book book = bookRepository
            .findByIdForUpdate(bookId)
            .orElseThrow(() -> new BookNotFoundException(bookId));

        expireReadyHoldsForBook(book, LocalDate.now(), Instant.now());

        if (!member.isActive()) {
            throw new BusinessRuleException("Deactivated member accounts cannot place holds");
        }

        List<BookCopy> copies = bookCopyRepository != null && book.getId() != null
            ? bookCopyRepository.findAllByBookIdOrderByIdAsc(book.getId())
            : List.of();

        if (!copies.isEmpty()) {
            boolean anyAvailable = copies.stream().anyMatch(c -> c.getStatus() == BookCopyStatus.AVAILABLE);
            if (anyAvailable) {
                throw new BusinessRuleException(
                    "This book is currently available on the shelf and can be borrowed directly"
                );
            }
            boolean anyCirculating = copies.stream()
                .anyMatch(c -> c.getStatus() == BookCopyStatus.LOANED || c.getStatus() == BookCopyStatus.ON_HOLD);
            if (!anyCirculating) {
                throw new BusinessRuleException(
                    "No circulating copies exist for this title (copies are damaged or lost)"
                );
            }
        } else {
            boolean bookHasActiveHold = holdRepository.existsByBookIdAndStatusIn(book.getId(), ACTIVE_STATUSES);
            if (book.isAvailable() && !bookHasActiveHold) {
                throw new BusinessRuleException(
                    "This book is currently available on the shelf and can be borrowed directly"
                );
            }
        }

        if (loanRepository.existsByBookIdAndMemberIdAndReturnedOnIsNull(book.getId(), member.getId())) {
            throw new BusinessRuleException("You already have this book checked out");
        }

        if (holdRepository.existsByBookIdAndMemberIdAndStatusIn(book.getId(), member.getId(), ACTIVE_STATUSES)) {
            throw new BusinessRuleException("You already have an active hold for this book");
        }

        Hold saved = holdRepository.save(new Hold(book, member, Instant.now()));
        int queuePosition = computeQueuePosition(book.getId(), saved.getId());
        return HoldResponse.from(saved, queuePosition);
    }

    @Transactional
    public HoldResponse cancelHold(Long holdId, String actorEmail, boolean isStaff) {
        lockHoldBook(holdId);
        Hold hold = holdRepository
            .findByIdForUpdate(holdId)
            .orElseThrow(() -> new ResourceNotFoundException("Hold", holdId));

        if (!isStaff && (actorEmail == null || !hold.getMember().getEmail().equalsIgnoreCase(actorEmail.trim()))) {
            throw new ResponseStatusException(
                HttpStatus.FORBIDDEN,
                "You can only cancel your own holds"
            );
        }

        if (!hold.isActive()) {
            throw new BusinessRuleException("This hold is no longer active");
        }

        Book book = bookRepository
            .findByIdForUpdate(hold.getBook().getId())
            .orElseThrow(() -> new BookNotFoundException(hold.getBook().getId()));

        boolean wasReady = hold.getStatus() == HoldStatus.READY_FOR_PICKUP;
        BookCopy releasedCopy = hold.getCopy();
        hold.markCancelled(Instant.now());
        Hold saved = holdRepository.save(hold);

        if (wasReady) {
            promoteNextWaitingOrReleaseCopy(book, releasedCopy, LocalDate.now(), Instant.now());
        }

        return HoldResponse.from(saved, 0);
    }

    @Transactional
    public LoanResponse fulfillReadyHold(Long holdId) {
        lockHoldBook(holdId);
        Hold hold = holdRepository
            .findById(holdId)
            .orElseThrow(() -> new ResourceNotFoundException("Hold", holdId));

        if (hold.getStatus() != HoldStatus.READY_FOR_PICKUP) {
            throw new BusinessRuleException(
                "Only holds that are ready for pickup can be fulfilled"
            );
        }

        Long copyId = hold.getCopy() != null ? hold.getCopy().getId() : null;
        return loanService.borrow(new BorrowRequest(hold.getBook().getId(), hold.getMember().getId(), copyId));
    }

    @Transactional
    public List<HoldResponse> getActiveHoldsForDesk() {
        expireStaleReadyHoldsInternal();
        List<Hold> active = holdRepository.findAllByStatusInOrderByPlacedAtAscIdAsc(ACTIVE_STATUSES);
        Map<Long, Integer> queueCounters = new HashMap<>();
        Map<Long, Integer> positionByHoldId = new HashMap<>();

        for (Hold hold : active) {
            if (hold.getStatus() == HoldStatus.WAITING) {
                Long bookId = hold.getBook().getId();
                int nextPos = queueCounters.getOrDefault(bookId, 0) + 1;
                queueCounters.put(bookId, nextPos);
                positionByHoldId.put(hold.getId(), nextPos);
            } else {
                positionByHoldId.put(hold.getId(), 0);
            }
        }

        return active.stream()
            .sorted(
                Comparator
                    .comparingInt((Hold h) -> h.getStatus() == HoldStatus.READY_FOR_PICKUP ? 0 : 1)
                    .thenComparing(Hold::getPlacedAt)
                    .thenComparing(Hold::getId)
            )
            .map(hold -> HoldResponse.from(hold, positionByHoldId.getOrDefault(hold.getId(), 0)))
            .toList();
    }

    @Transactional
    public MemberBookshelfResponse getBookshelf(String userEmail, boolean autoProvisionMember) {
        Member member = autoProvisionMember
            ? memberService.ensureMemberForEmail(userEmail, null)
            : memberService.findByEmail(userEmail)
                .orElseThrow(() -> new ResourceNotFoundException("No member profile found for " + userEmail));

        expireStaleReadyHoldsInternal();
        LocalDate today = LocalDate.now();
        List<Loan> activeLoanEntities = loanRepository.findAllByMemberIdAndReturnedOnIsNullOrderByDueOnAsc(member.getId());
        List<Loan> returnedEntities = loanRepository.findAllByMemberIdAndReturnedOnIsNotNullOrderByReturnedOnDescIdDesc(member.getId());
        List<Loan> fineEntities = loanRepository.findAllByMemberIdAndFineStatusNotOrderByIdDesc(member.getId(), FineStatus.NONE);
        List<Hold> activeHoldEntities = holdRepository.findAllByMemberIdAndStatusInOrderByPlacedAtDescIdDesc(member.getId(), ACTIVE_STATUSES);
        List<Hold> pastHoldEntities = holdRepository.findAllByMemberIdAndStatusInOrderByPlacedAtDescIdDesc(member.getId(), PAST_STATUSES);

        BigDecimal unpaidFinesTotal = loanService.calculateUnpaidFines(member.getId(), today);
        boolean fineBlocked = unpaidFinesTotal.compareTo(policy.getFineBlockThreshold()) >= 0;
        boolean limitReached = activeLoanEntities.size() >= policy.getMaxActiveLoans();
        boolean borrowingBlocked = !member.isActive() || fineBlocked || limitReached;

        String blockReason = null;
        if (!member.isActive()) {
            blockReason = "Account deactivated by staff";
        } else if (fineBlocked) {
            blockReason = "Unpaid fines ($" + unpaidFinesTotal.setScale(2, RoundingMode.HALF_UP)
                + ") reached the $" + policy.getFineBlockThreshold().setScale(2, RoundingMode.HALF_UP) + " block threshold";
        } else if (limitReached) {
            blockReason = "Maximum active loan limit (" + policy.getMaxActiveLoans() + ") reached";
        }

        Set<Long> booksWithActiveHolds = holdRepository.findBookIdsByStatusIn(ACTIVE_STATUSES);
        BigDecimal dailyRate = policy.getDailyFineRate();

        List<LoanResponse> activeLoans = activeLoanEntities.stream()
            .map(loan -> LoanResponse.from(loan, booksWithActiveHolds.contains(loan.getBook().getId()), null, dailyRate, fineBlocked))
            .toList();

        List<LoanResponse> returnHistory = returnedEntities.stream()
            .map(loan -> LoanResponse.from(loan, booksWithActiveHolds.contains(loan.getBook().getId()), null, dailyRate, fineBlocked))
            .toList();

        java.util.LinkedHashMap<Long, LoanResponse> fineMap = new java.util.LinkedHashMap<>();
        for (LoanResponse active : activeLoans) {
            if (active.fineStatus() == FineStatus.UNPAID) {
                fineMap.put(active.id(), active);
            }
        }
        for (Loan settled : fineEntities) {
            fineMap.putIfAbsent(
                settled.getId(),
                LoanResponse.from(settled, booksWithActiveHolds.contains(settled.getBook().getId()), null, dailyRate, fineBlocked)
            );
        }

        List<HoldResponse> activeHolds = new ArrayList<>();
        for (Hold hold : activeHoldEntities) {
            int pos = hold.getStatus() == HoldStatus.WAITING
                ? computeQueuePosition(hold.getBook().getId(), hold.getId())
                : 0;
            activeHolds.add(HoldResponse.from(hold, pos));
        }

        List<HoldResponse> pastHolds = pastHoldEntities.stream()
            .map(hold -> HoldResponse.from(hold, 0))
            .toList();

        return new MemberBookshelfResponse(
            member.getId(),
            member.getFullName(),
            member.getEmail(),
            member.isActive(),
            policy.getMaxActiveLoans(),
            dailyRate,
            unpaidFinesTotal,
            policy.getFineBlockThreshold(),
            borrowingBlocked,
            blockReason,
            activeLoans,
            returnHistory,
            new ArrayList<>(fineMap.values()),
            activeHolds,
            pastHolds
        );
    }

    @Transactional
    public int expireStaleReadyHolds() {
        return expireStaleReadyHoldsInternal();
    }

    private int expireStaleReadyHoldsInternal() {
        LocalDate today = LocalDate.now();
        Instant now = Instant.now();
        // Scalar IDs avoid putting stale Hold entities into the persistence context before waiting.
        // Multiple books are always locked in ascending order; ordinary operations touch one book.
        List<Long> bookIds = holdRepository.findExpiredBookIds(HoldStatus.READY_FOR_PICKUP, today);
        int count = 0;
        for (Long bookId : bookIds) {
            Book book = bookRepository.findByIdForUpdate(bookId).orElse(null);
            if (book == null) continue;
            count += expireReadyHoldsForBook(book, today, now);
        }
        return count;
    }

    private int expireReadyHoldsForBook(Book book, LocalDate today, Instant now) {
        int count = 0;
        for (Hold hold : holdRepository.findAllByBookIdAndStatusOrderByPlacedAtAscIdAsc(
                book.getId(), HoldStatus.READY_FOR_PICKUP)) {
            if (hold.getExpiresOn() == null || !hold.getExpiresOn().isBefore(today)) continue;
            BookCopy releasedCopy = hold.getCopy();
            hold.markExpired();
            holdRepository.save(hold);
            if (notificationService != null) notificationService.notifyHoldExpired(hold);
            count++;
            promoteNextWaitingOrReleaseCopy(book, releasedCopy, today, now);
        }
        return count;
    }

    private void lockHoldBook(Long holdId) {
        Long bookId = holdRepository.findBookIdById(holdId)
            .orElseThrow(() -> new ResourceNotFoundException("Hold", holdId));
        Book book = bookRepository.findByIdForUpdate(bookId)
            .orElseThrow(() -> new BookNotFoundException(bookId));
        expireReadyHoldsForBook(book, LocalDate.now(), Instant.now());
    }

    private void promoteNextWaitingOrReleaseCopy(Book book, BookCopy releasedCopy, LocalDate today, Instant now) {
        Optional<Hold> nextWaiting = holdRepository.findFirstByBookIdAndStatusOrderByPlacedAtAscIdAsc(
            book.getId(),
            HoldStatus.WAITING
        );
        if (nextWaiting.isPresent()) {
            Hold promoted = nextWaiting.get();
            promoted.markReadyForPickup(now, today.plusDays(Hold.PICKUP_WINDOW_DAYS));
            if (releasedCopy != null) {
                promoted.setCopy(releasedCopy);
                if (bookCopyRepository != null) {
                    releasedCopy.setStatus(BookCopyStatus.ON_HOLD);
                    bookCopyRepository.save(releasedCopy);
                }
            }
            holdRepository.save(promoted);
            if (bookCopyRepository == null) {
                book.markBorrowed();
                bookRepository.save(book);
            }
            if (notificationService != null) {
                notificationService.notifyHoldReady(promoted);
            }
        } else {
            if (releasedCopy != null && bookCopyRepository != null) {
                releasedCopy.setStatus(BookCopyStatus.AVAILABLE);
                bookCopyRepository.save(releasedCopy);
                long avail = bookCopyRepository.countByBookIdAndStatus(book.getId(), BookCopyStatus.AVAILABLE);
                book.setAvailable(avail > 0);
                bookRepository.save(book);
            } else if (!loanRepository.existsByBookIdAndReturnedOnIsNull(book.getId())) {
                book.markReturned();
                bookRepository.save(book);
            }
        }
    }

    private int computeQueuePosition(Long bookId, Long holdId) {
        List<Hold> waiting = holdRepository.findAllByBookIdAndStatusOrderByPlacedAtAscIdAsc(
            bookId,
            HoldStatus.WAITING
        );
        for (int i = 0; i < waiting.size(); i++) {
            if (waiting.get(i).getId().equals(holdId)) {
                return i + 1;
            }
        }
        return waiting.size();
    }
}
