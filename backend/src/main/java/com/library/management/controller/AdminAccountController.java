
package com.library.management.controller;

import com.library.management.dto.*;
import com.library.management.service.AccountService;

import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/admin/users")
public class AdminAccountController {

    private final AccountService accountService;

    public AdminAccountController(AccountService accountService) {
        this.accountService = accountService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public AccountResponse createUser(
            @Valid @RequestBody CreateAccountRequest request
    ) {
        return accountService.create(request);
    }

    @GetMapping
    public java.util.List<AccountResponse> getAllUsers() {
        return accountService.getAllUsers();
    }

    @PatchMapping("/{id}/status")
    public AccountResponse updateUserStatus(
            @PathVariable Long id,
            @Valid @RequestBody UpdateAccountStatusRequest request,
            @AuthenticationPrincipal Jwt jwt
    ) {
        String actorEmail = jwt != null ? jwt.getSubject() : null;
        return accountService.updateStatus(id, Boolean.TRUE.equals(request.enabled()), actorEmail);
    }

    @PatchMapping("/{id}/role")
    public AccountResponse updateUserRole(
            @PathVariable Long id,
            @Valid @RequestBody UpdateAccountRoleRequest request,
            @AuthenticationPrincipal Jwt jwt
    ) {
        String actorEmail = jwt != null ? jwt.getSubject() : null;
        return accountService.updateRole(id, request.role(), actorEmail);
    }

    @PostMapping("/{id}/reset-password")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void resetPassword(
            @PathVariable Long id,
            @Valid @RequestBody ResetPasswordRequest request
    ) {
        accountService.resetPassword(id, request.newPassword());
    }
}
