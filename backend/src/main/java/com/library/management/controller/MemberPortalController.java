package com.library.management.controller;

import com.library.management.dto.LoanResponse;
import com.library.management.dto.MemberBookshelfResponse;
import com.library.management.service.HoldService;
import com.library.management.service.LoanService;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/me")
public class MemberPortalController {

    private final HoldService holdService;
    private final LoanService loanService;

    public MemberPortalController(HoldService holdService, LoanService loanService) {
        this.holdService = holdService;
        this.loanService = loanService;
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
