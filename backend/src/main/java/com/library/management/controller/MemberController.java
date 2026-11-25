package com.library.management.controller;

import com.library.management.dto.CreateMemberRequest;
import com.library.management.dto.MemberDetailResponse;
import com.library.management.dto.UpdateMemberRequest;
import com.library.management.dto.UpdateMemberStatusRequest;
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

    @GetMapping("/{id}")
    public MemberDetailResponse getMemberDetail(@PathVariable Long id) {
        return memberService.getMemberDetail(id);
    }

    @PutMapping("/{id}")
    public Member updateMember(
            @PathVariable Long id,
            @Valid @RequestBody UpdateMemberRequest request
    ) {
        return memberService.updateMember(id, request);
    }

    @PatchMapping("/{id}/status")
    public Member updateMemberStatus(
            @PathVariable Long id,
            @Valid @RequestBody UpdateMemberStatusRequest request
    ) {
        return memberService.updateMemberStatus(id, Boolean.TRUE.equals(request.active()));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteMember(@PathVariable Long id) {
        memberService.deleteMember(id);
    }
}
