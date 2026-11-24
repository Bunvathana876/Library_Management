package com.library.management.service;

import com.library.management.dto.CreateMemberRequest;
import com.library.management.exception.BusinessRuleException;
import com.library.management.model.Member;
import com.library.management.repository.MemberRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MemberServiceTest {

    @Mock
    private MemberRepository memberRepository;

    @InjectMocks
    private MemberService memberService;

    @Test
    void shouldTrimNameAndNormalizeEmailWhenRegistering() {
        CreateMemberRequest request = new CreateMemberRequest(
            "  Sam Reader  ",
            "  SAM@EXAMPLE.COM  "
        );
        when(memberRepository.existsByEmail("sam@example.com"))
            .thenReturn(false);
        when(memberRepository.save(any(Member.class)))
            .thenAnswer(invocation -> invocation.getArgument(0));

        Member registered = memberService.register(request);

        assertEquals("Sam Reader", registered.getFullName());
        assertEquals("sam@example.com", registered.getEmail());
        verify(memberRepository).existsByEmail("sam@example.com");
    }

    @Test
    void shouldRejectAlreadyRegisteredEmail() {
        CreateMemberRequest request = new CreateMemberRequest(
            "Sam Reader",
            "SAM@example.com"
        );
        when(memberRepository.existsByEmail("sam@example.com"))
            .thenReturn(true);

        BusinessRuleException exception = assertThrows(
            BusinessRuleException.class,
            () -> memberService.register(request)
        );

        assertEquals("This email is already registered", exception.getMessage());
    }
}
