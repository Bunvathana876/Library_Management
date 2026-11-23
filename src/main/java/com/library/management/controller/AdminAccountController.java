
package com.library.management.controller;

import com.library.management.dto.*;
import com.library.management.service.AccountService;

import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;
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
}
