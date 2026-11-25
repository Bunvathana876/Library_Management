
package com.library.management.service;

import com.library.management.dto.CreateMemberRequest;
import com.library.management.exception.BusinessRuleException;
import com.library.management.model.Member;
import com.library.management.repository.MemberRepository;

import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Locale;
import java.util.Optional;

@Service
public class MemberService {

    private final MemberRepository memberRepository;

    public MemberService(MemberRepository memberRepository) {
        this.memberRepository = memberRepository;
    }

    @Transactional
    public Member register(CreateMemberRequest request) {

        String email = request.email()
            .trim()
            .toLowerCase(Locale.ROOT);

        if (memberRepository.existsByEmail(email)) {
            throw new BusinessRuleException(
                "This email is already registered"
            );
        }

        Member member = new Member(
            request.fullName().trim(),
            email
        );

        return memberRepository.save(member);
    }

    @Transactional(readOnly = true)
    public List<Member> getAllMembers() {
        return memberRepository.findAll(
            Sort.by("id")
        );
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
        Optional<Member> existing = memberRepository.findByEmailIgnoreCase(email);
        if (existing.isPresent()) {
            return existing.get();
        }
        String resolvedName = resolveDisplayName(optionalFullName, email);
        return memberRepository.save(new Member(resolvedName, email));
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
