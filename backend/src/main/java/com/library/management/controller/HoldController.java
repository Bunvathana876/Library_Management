package com.library.management.controller;

import com.library.management.dto.CreateHoldRequest;
import com.library.management.dto.HoldResponse;
import com.library.management.dto.LoanResponse;
import com.library.management.service.HoldService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/holds")
public class HoldController {

    private final HoldService holdService;

    public HoldController(HoldService holdService) {
        this.holdService = holdService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public HoldResponse placeHold(
            @Valid @RequestBody CreateHoldRequest request,
            @AuthenticationPrincipal Jwt jwt,
            Authentication authentication
    ) {
        return holdService.placeHold(
            request.bookId(),
            request.memberId(),
            jwt.getSubject(),
            isStaff(authentication)
        );
    }

    @GetMapping("/active")
    public List<HoldResponse> getActiveHolds() {
        return holdService.getActiveHoldsForDesk();
    }

    @PostMapping("/{id}/cancel")
    public HoldResponse cancelHold(
            @PathVariable Long id,
            @AuthenticationPrincipal Jwt jwt,
            Authentication authentication
    ) {
        return holdService.cancelHold(id, jwt.getSubject(), isStaff(authentication));
    }

    @PostMapping("/{id}/fulfill")
    public LoanResponse fulfillHold(@PathVariable Long id) {
        return holdService.fulfillReadyHold(id);
    }

    private static boolean isStaff(Authentication authentication) {
        if (authentication == null) {
            return false;
        }
        for (GrantedAuthority authority : authentication.getAuthorities()) {
            String role = authority.getAuthority();
            if ("ROLE_ADMIN".equals(role) || "ROLE_LIBRARIAN".equals(role)) {
                return true;
            }
        }
        return false;
    }
}
