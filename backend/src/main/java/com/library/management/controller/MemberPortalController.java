package com.library.management.controller;

import com.library.management.dto.LoanResponse;
import com.library.management.dto.BorrowRequest;
import com.library.management.dto.SelfBorrowRequest;
import com.library.management.dto.MemberBookshelfResponse;
import com.library.management.service.HoldService;
import com.library.management.service.LoanService;
import com.library.management.service.MemberService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/me")
public class MemberPortalController {

    private final HoldService holdService;
    private final LoanService loanService;
    private final MemberService memberService;

    public MemberPortalController(HoldService holdService, LoanService loanService, MemberService memberService) {
        this.holdService = holdService;
        this.loanService = loanService;
        this.memberService = memberService;
    }

    @PostMapping("/loans")
    @ResponseStatus(HttpStatus.CREATED)
    public LoanResponse borrowOwnBook(@Valid @RequestBody SelfBorrowRequest request,
                                     @AuthenticationPrincipal Jwt jwt) {
        // Resolve identity before circulation locks. This transaction finishes before borrow starts;
        // with open-in-view disabled, borrow reloads fresh Member state under its write lock.
        Long memberId = memberService.ensureMemberForEmail(jwt.getSubject(), null).getId();
        return loanService.borrow(new BorrowRequest(request.bookId(), memberId));
    }

    @GetMapping("/bookshelf")
    public MemberBookshelfResponse getBookshelf(@AuthenticationPrincipal Jwt jwt) {
        return holdService.getBookshelf(jwt.getSubject(), true);
    }

    @PostMapping("/loans/{id}/renew")
    public LoanResponse renewOwnLoan(
            @PathVariable Long id,
            @AuthenticationPrincipal Jwt jwt
    ) {
        return loanService.renewOwnLoan(id, jwt.getSubject());
    }
}
