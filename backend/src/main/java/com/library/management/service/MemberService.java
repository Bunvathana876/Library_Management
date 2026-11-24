
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
}
