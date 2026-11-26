package com.library.management.service;

import com.library.management.config.CirculationPolicyProperties;
import com.library.management.dto.CreateMemberRequest;
import com.library.management.dto.HoldResponse;
import com.library.management.dto.LoanResponse;
import com.library.management.dto.MemberDetailResponse;
import com.library.management.dto.UpdateMemberRequest;
import com.library.management.exception.BusinessRuleException;
import com.library.management.exception.ResourceNotFoundException;
import com.library.management.model.FineStatus;
import com.library.management.model.Hold;
import com.library.management.model.HoldStatus;
import com.library.management.model.Loan;
import com.library.management.model.Member;
import com.library.management.repository.HoldRepository;
import com.library.management.repository.LoanRepository;
import com.library.management.repository.MemberRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

@Service
public class MemberService {

    private static final List<HoldStatus> ACTIVE_HOLD_STATUSES =
        List.of(HoldStatus.WAITING, HoldStatus.READY_FOR_PICKUP);
    private static final List<HoldStatus> PAST_HOLD_STATUSES =
        List.of(HoldStatus.FULFILLED, HoldStatus.CANCELLED, HoldStatus.EXPIRED);

    private final MemberRepository memberRepository;
    private final LoanRepository loanRepository;
    private final HoldRepository holdRepository;
    private final LoanService loanService;
    private final CirculationPolicyProperties policy;
    private final com.library.management.repository.AppUserRepository users;

    public MemberService(MemberRepository memberRepository) {
        this(memberRepository, null, null, null, CirculationPolicyProperties.defaults());
    }

    public MemberService(
            MemberRepository memberRepository,
            LoanRepository loanRepository,
            HoldRepository holdRepository,
            LoanService loanService,
            CirculationPolicyProperties policy
    ) {
        this(memberRepository, loanRepository, holdRepository, loanService, policy, null);
    }

    @Autowired
    public MemberService(MemberRepository memberRepository, LoanRepository loanRepository,
            HoldRepository holdRepository, LoanService loanService, CirculationPolicyProperties policy,
            com.library.management.repository.AppUserRepository users) {
        this.users = users;
        this.memberRepository = memberRepository;
        this.loanRepository = loanRepository;
        this.holdRepository = holdRepository;
        this.loanService = loanService;
        this.policy = policy != null ? policy : CirculationPolicyProperties.defaults();
    }

    @Transactional
    public Member register(CreateMemberRequest request) {
        String email = request.email().trim().toLowerCase(Locale.ROOT);

        if (memberRepository.existsByEmail(email)) {
            throw new BusinessRuleException("This email is already registered");
        }

        Member member = new Member(
            request.fullName().trim(),
            email,
            normalizeOptional(request.phone()),
            normalizeOptional(request.notes())
        );

        Member saved = memberRepository.save(member);
        enrichMembers(List.of(saved));
        return saved;
    }

    @Transactional(readOnly = true)
    public List<Member> getAllMembers() {
        List<Member> list = memberRepository.findAll(Sort.by("id"));
        enrichMembers(list);
        return list;
    }

    @Transactional(readOnly = true)
    public MemberDetailResponse getMemberDetail(Long id) {
        Member member = memberRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Member", id));

        enrichMembers(List.of(member));

        LocalDate today = LocalDate.now();
        List<Loan> activeEntities = loanRepository != null
            ? loanRepository.findAllByMemberIdAndReturnedOnIsNullOrderByDueOnAsc(member.getId())
            : List.of();
        List<Loan> returnedEntities = loanRepository != null
            ? loanRepository.findAllByMemberIdAndReturnedOnIsNotNullOrderByReturnedOnDescIdDesc(member.getId())
            : List.of();
        List<Loan> fineEntities = loanRepository != null
            ? loanRepository.findAllByMemberIdAndFineStatusNotOrderByIdDesc(member.getId(), FineStatus.NONE)
            : List.of();
        List<Hold> activeHoldEntities = holdRepository != null
            ? holdRepository.findAllByMemberIdAndStatusInOrderByPlacedAtDescIdDesc(member.getId(), ACTIVE_HOLD_STATUSES)
            : List.of();
        List<Hold> pastHoldEntities = holdRepository != null
            ? holdRepository.findAllByMemberIdAndStatusInOrderByPlacedAtDescIdDesc(member.getId(), PAST_HOLD_STATUSES)
            : List.of();

        Set<Long> booksWithHolds = holdRepository != null
            ? holdRepository.findBookIdsByStatusIn(ACTIVE_HOLD_STATUSES)
            : Set.of();

        BigDecimal rate = policy.getDailyFineRate();
        boolean fineBlocked = member.getUnpaidFinesTotal().compareTo(policy.getFineBlockThreshold()) >= 0;

        List<LoanResponse> activeLoans = activeEntities.stream()
            .map(l -> LoanResponse.from(l, booksWithHolds.contains(l.getBook().getId()), null, rate, fineBlocked))
            .toList();
        List<LoanResponse> returnHistory = returnedEntities.stream()
            .map(l -> LoanResponse.from(l, booksWithHolds.contains(l.getBook().getId()), null, rate, fineBlocked))
            .toList();

        Map<Long, LoanResponse> fineMap = new LinkedHashMap<>();
        for (LoanResponse active : activeLoans) {
            if (active.fineStatus() == FineStatus.UNPAID) {
                fineMap.put(active.id(), active);
            }
        }
        for (Loan settled : fineEntities) {
            fineMap.putIfAbsent(
                settled.getId(),
                LoanResponse.from(settled, booksWithHolds.contains(settled.getBook().getId()), null, rate, fineBlocked)
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
            .map(h -> HoldResponse.from(h, 0))
            .toList();

        return new MemberDetailResponse(
            member.getId(),
            member.getFullName(),
            member.getEmail(),
            member.isActive(),
            member.getPhone(),
            member.getNotes(),
            member.getCreatedAt(),
            member.getActiveLoanCount(),
            member.getOverdueLoanCount(),
            policy.getMaxActiveLoans(),
            member.getUnpaidFinesTotal(),
            policy.getFineBlockThreshold(),
            member.isBorrowingBlocked(),
            member.getBorrowingBlockReason(),
            activeLoans,
            returnHistory,
            new ArrayList<>(fineMap.values()),
            activeHolds,
            pastHolds
        );
    }

    @Transactional
    public Member updateMember(Long id, UpdateMemberRequest request) {
        Member member = memberRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Member", id));

        String email = request.email().trim().toLowerCase(Locale.ROOT);
        Optional<Member> conflict = memberRepository.findByEmailIgnoreCase(email);
        if (conflict.isPresent() && !conflict.get().getId().equals(id)) {
            throw new BusinessRuleException("Another member is already registered with this email");
        }

        var account = member.getAccount();
        if (!member.getEmail().equals(email)) {
            if (account != null && account.getRole() != com.library.management.model.UserRole.MEMBER) {
                throw new BusinessRuleException("Staff account emails cannot be changed through member profiles");
            }
            var accountConflict = users != null ? users.findByEmail(email).orElse(null) : null;
            if (accountConflict != null && (account == null || !accountConflict.getId().equals(account.getId()))) {
                throw new BusinessRuleException("Another account is already registered with this email");
            }
            if (account != null) account.changeEmail(email);
        }

        member.updateProfile(
            request.fullName().trim(),
            email,
            normalizeOptional(request.phone()),
            normalizeOptional(request.notes())
        );

        Member saved = memberRepository.save(member);
        enrichMembers(List.of(saved));
        return saved;
    }

    @Transactional
    public Member updateMemberStatus(Long id, boolean active) {
        Member member = memberRepository.findByIdForUpdate(id)
            .orElseThrow(() -> new ResourceNotFoundException("Member", id));

        if (!active && loanRepository != null && loanRepository.countByMemberIdAndReturnedOnIsNull(id) > 0) {
            throw new BusinessRuleException("Cannot deactivate a member who currently has active checked-out books");
        }

        member.setActive(active);
        Member saved = memberRepository.save(member);
        enrichMembers(List.of(saved));
        return saved;
    }

    @Transactional
    public void deleteMember(Long id) {
        Member member = memberRepository.findByIdForUpdate(id)
            .orElseThrow(() -> new ResourceNotFoundException("Member", id));

        if (member.getAccount() != null) {
            throw new BusinessRuleException("Members linked to login accounts cannot be deleted; deactivate instead");
        }

        if (loanRepository != null && loanRepository.existsByMemberId(id)) {
            throw new BusinessRuleException(
                "Members with loan history cannot be deleted; deactivate the member instead"
            );
        }

        if (holdRepository != null && holdRepository.existsByMemberIdAndStatusIn(id, ACTIVE_HOLD_STATUSES)) {
            throw new BusinessRuleException("Cancel active holds for this member before deleting");
        }

        if (holdRepository != null) {
            holdRepository.deleteAllByMemberId(id);
        }
        memberRepository.delete(member);
    }

    @Transactional(readOnly = true)
    public Optional<Member> findByEmail(String rawEmail) {
        if (rawEmail == null || rawEmail.isBlank()) {
            return Optional.empty();
        }
        return memberRepository.findByEmailIgnoreCase(rawEmail.trim().toLowerCase(Locale.ROOT));
    }

    @Transactional
    public Member ensureMemberForEmail(String rawEmail, String optionalFullName) {
        String email = rawEmail.trim().toLowerCase(Locale.ROOT);
        // Lock the account first so concurrent first-time profile requests cannot create duplicates.
        var account = users != null ? users.findByEmailForUpdate(email).orElse(null) : null;
        if (account != null) {
            Optional<Member> linked = memberRepository.findByAccountId(account.getId());
            if (linked.isPresent()) return linked.get();
        }
        Optional<Member> existing = memberRepository.findByEmailIgnoreCase(email);
        Member member = existing.orElseGet(() -> new Member(resolveDisplayName(optionalFullName, email), email));
        if (account != null) member.linkAccount(account);
        return memberRepository.save(member);
    }

    private void enrichMembers(List<Member> members) {
        if (members == null || members.isEmpty() || loanRepository == null || loanService == null) {
            return;
        }
        LocalDate today = LocalDate.now();
        Map<Long, Integer> activeCounts = new HashMap<>();
        Map<Long, Integer> overdueCounts = new HashMap<>();

        for (Loan loan : loanRepository.findAllByReturnedOnIsNullOrderByDueOnAsc()) {
            if (loan.getMember() == null || loan.getMember().getId() == null) continue;
            Long memberId = loan.getMember().getId();
            activeCounts.merge(memberId, 1, Integer::sum);
            if (loan.getDueOn() != null && loan.getDueOn().isBefore(today)) {
                overdueCounts.merge(memberId, 1, Integer::sum);
            }
        }

        for (Member m : members) {
            if (m.getId() == null) continue;
            int active = activeCounts.getOrDefault(m.getId(), 0);
            int overdue = overdueCounts.getOrDefault(m.getId(), 0);
            BigDecimal unpaid = loanService.calculateUnpaidFines(m.getId(), today);
            boolean fineBlocked = unpaid.compareTo(policy.getFineBlockThreshold()) >= 0;
            boolean limitReached = active >= policy.getMaxActiveLoans();
            boolean blocked = !m.isActive() || fineBlocked || limitReached;

            String reason = null;
            if (!m.isActive()) {
                reason = "Deactivated";
            } else if (fineBlocked) {
                reason = "Unpaid fines ($" + unpaid.setScale(2, RoundingMode.HALF_UP) + ")";
            } else if (limitReached) {
                reason = "Active loan limit (" + active + "/" + policy.getMaxActiveLoans() + ")";
            }

            m.applyStanding(active, overdue, unpaid, blocked, reason);
        }
    }

    private int computeQueuePosition(Long bookId, Long holdId) {
        if (holdRepository == null) return 0;
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

    private static String normalizeOptional(String raw) {
        if (raw == null) return null;
        String stripped = raw.trim();
        return stripped.isEmpty() ? null : stripped;
    }

    private static String resolveDisplayName(String optionalFullName, String email) {
        if (optionalFullName != null && !optionalFullName.isBlank()) {
            String trimmed = optionalFullName.trim();
            return trimmed.length() <= 120 ? trimmed : trimmed.substring(0, 120).trim();
        }
        int atIndex = email.indexOf('@');
        String localPart = atIndex > 0 ? email.substring(0, atIndex) : email;
        String[] segments = localPart.split("[._-]+");
        StringBuilder builder = new StringBuilder();
        for (String segment : segments) {
            if (!segment.isEmpty()) {
                if (!builder.isEmpty()) {
                    builder.append(' ');
                }
                builder.append(Character.toUpperCase(segment.charAt(0)));
                if (segment.length() > 1) {
                    builder.append(segment.substring(1));
                }
            }
        }
        String derived = builder.toString().trim();
        if (derived.isEmpty()) {
            return "Library Member";
        }
        return derived.length() <= 120 ? derived : derived.substring(0, 120).trim();
    }
}
