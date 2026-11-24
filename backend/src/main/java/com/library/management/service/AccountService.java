
package com.library.management.service;

import com.library.management.dto.*;
import com.library.management.exception.BusinessRuleException;
import com.library.management.model.*;
import com.library.management.repository.AppUserRepository;

import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.Locale;

@Service
public class AccountService {

    private final AppUserRepository users;
    private final PasswordEncoder encoder;

    public AccountService(
            AppUserRepository users,
            PasswordEncoder encoder
    ) {
        this.users = users;
        this.encoder = encoder;
    }

    @Transactional
    public AccountResponse create(CreateAccountRequest request) {

        if (request.role() == UserRole.ADMIN) {
            throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "Admin accounts cannot be created here"
            );
        }

        String email = request.email()
            .trim()
            .toLowerCase(Locale.ROOT);

        if (users.existsByEmail(email)) {
            throw new BusinessRuleException(
                "An account with this email already exists"
            );
        }

        AppUser user = new AppUser(
            email,
            encoder.encode(request.password()),
            request.role()
        );

        AppUser saved = users.save(user);

        return new AccountResponse(
            saved.getId(),
            saved.getEmail(),
            saved.getRole()
        );
    }
}
