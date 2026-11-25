package com.library.management.service;

import com.library.management.dto.BorrowRequest;
import com.library.management.dto.HoldResponse;
import com.library.management.dto.LoanResponse;
import com.library.management.dto.MemberBookshelfResponse;
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
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

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

    public HoldService(
            HoldRepository holdRepository,
            BookRepository bookRepository,
            MemberRepository memberRepository,
            LoanRepository loanRepository,
            MemberService memberService,
            LoanService loanService
    ) {
        this.holdRepository = holdRepository;
        this.bookRepository = bookRepository;
        this.memberRepository = memberRepository;
        this.loanRepository = loanRepository;
        this.memberService = memberService;
        this.loanService = loanService;
    }

    @Transactional
    public HoldResponse placeHold(
            Long bookId,
            Long requestedMemberId,
            String actorEmail,
            boolean isStaff
    ) {
        expireStaleReadyHoldsInternal();

        Book book = bookRepository
            .findByIdForUpdate(bookId)
            .orElseThrow(() -> new BookNotFoundException(bookId));

        Member member;
        if (isStaff && requestedMemberId != null) {
            member = memberRepository
                .findById(requestedMemberId)
                .orElseThrow(() -> new ResourceNotFoundException("Member", requestedMemberId));
        } else {
            member = memberService.ensureMemberForEmail(actorEmail, null);
        }

        boolean bookHasActiveHold = holdRepository.existsByBookIdAndStatusIn(book.getId(), ACTIVE_STATUSES);
        if (book.isAvailable() && !bookHasActiveHold) {
            throw new BusinessRuleException(
                "This book is currently available on the shelf and can be borrowed directly"
            );
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
        expireStaleReadyHoldsInternal();

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
        hold.markCancelled(Instant.now());
        Hold saved = holdRepository.save(hold);

        if (wasReady) {
            promoteNextWaitingOrReleaseBook(book, LocalDate.now(), Instant.now());
        }

        return HoldResponse.from(saved, 0);
    }

    @Transactional
    public LoanResponse fulfillReadyHold(Long holdId) {
        expireStaleReadyHoldsInternal();

        Hold hold = holdRepository
            .findByIdForUpdate(holdId)
            .orElseThrow(() -> new ResourceNotFoundException("Hold", holdId));

        if (hold.getStatus() != HoldStatus.READY_FOR_PICKUP) {
            throw new BusinessRuleException(
                "Only holds that are ready for pickup can be fulfilled"
            );
        }

        return loanService.borrow(new BorrowRequest(hold.getBook().getId(), hold.getMember().getId()));
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
        expireStaleReadyHoldsInternal();

        Member member = autoProvisionMember
            ? memberService.ensureMemberForEmail(userEmail, null)
            : memberService.findByEmail(userEmail)
                .orElseThrow(() -> new ResourceNotFoundException("No member profile found for " + userEmail));

        List<Loan> activeLoanEntities = loanRepository.findAllByMemberIdAndReturnedOnIsNullOrderByDueOnAsc(member.getId());
        List<Loan> returnedEntities = loanRepository.findAllByMemberIdAndReturnedOnIsNotNullOrderByReturnedOnDescIdDesc(member.getId());
        List<Hold> activeHoldEntities = holdRepository.findAllByMemberIdAndStatusInOrderByPlacedAtDescIdDesc(member.getId(), ACTIVE_STATUSES);
        List<Hold> pastHoldEntities = holdRepository.findAllByMemberIdAndStatusInOrderByPlacedAtDescIdDesc(member.getId(), PAST_STATUSES);

        Set<Long> booksWithActiveHolds = holdRepository.findBookIdsByStatusIn(ACTIVE_STATUSES);

        List<LoanResponse> activeLoans = activeLoanEntities.stream()
            .map(loan -> LoanResponse.from(loan, booksWithActiveHolds.contains(loan.getBook().getId())))
            .toList();

        List<LoanResponse> returnHistory = returnedEntities.stream()
            .map(loan -> LoanResponse.from(loan, booksWithActiveHolds.contains(loan.getBook().getId())))
            .toList();

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
            activeLoans,
            returnHistory,
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
        List<Hold> expiredHolds = holdRepository.findAllByStatusAndExpiresOnBefore(
            HoldStatus.READY_FOR_PICKUP,
            today
        );
        if (expiredHolds.isEmpty()) {
            return 0;
        }
        int count = 0;
        for (Hold hold : expiredHolds) {
            Book book = bookRepository.findByIdForUpdate(hold.getBook().getId()).orElse(null);
            hold.markExpired();
            holdRepository.save(hold);
            count++;
            if (book != null) {
                promoteNextWaitingOrReleaseBook(book, today, now);
            }
        }
        return count;
    }

    private void promoteNextWaitingOrReleaseBook(Book book, LocalDate today, Instant now) {
        Optional<Hold> nextWaiting = holdRepository.findFirstByBookIdAndStatusOrderByPlacedAtAscIdAsc(
            book.getId(),
            HoldStatus.WAITING
        );
        if (nextWaiting.isPresent()) {
            Hold promoted = nextWaiting.get();
            promoted.markReadyForPickup(now, today.plusDays(Hold.PICKUP_WINDOW_DAYS));
            holdRepository.save(promoted);
            book.markBorrowed();
            bookRepository.save(book);
        } else if (!loanRepository.existsByBookIdAndReturnedOnIsNull(book.getId())) {
            book.markReturned();
            bookRepository.save(book);
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
