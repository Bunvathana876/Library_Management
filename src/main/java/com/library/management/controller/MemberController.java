package com.library.management.controller;

import com.library.management.dto.CreateMemberRequest;
import com.library.management.model.Member;
import com.library.management.service.MemberService;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController 
@RequestMapping("/api/members")
public class MemberController {
    private final MemberService memberService;

    public MemberController(MemberService memberService) {
        this.memberService = memberService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Member register(
            @Valid @RequestBody CreateMemberRequest request
    ) {
        return memberService.register(request);
    }

    @GetMapping
    public List<Member> getAllMembers() {
        return memberService.getAllMembers();
    }
}
