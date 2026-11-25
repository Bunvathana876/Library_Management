
package com.library.management.controller;

import com.library.management.dto.ChangePasswordRequest;
import com.library.management.dto.LoginRequest;
import com.library.management.dto.LoginResponse;
import com.library.management.dto.RegisterRequest;
import com.library.management.service.AccountService;
import com.library.management.service.JwtService;

import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.*;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.core.annotation.AuthenticationPrincipal;

import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.Locale;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthenticationManager authenticationManager;
    private final JwtService jwtService;
    private final AccountService accountService;

    public AuthController(
            AuthenticationManager authenticationManager,
            JwtService jwtService,
            AccountService accountService
    ) {
        this.authenticationManager = authenticationManager;
        this.jwtService = jwtService;
        this.accountService = accountService;
    }

    @PostMapping("/login")
    public LoginResponse login(
            @Valid @RequestBody LoginRequest request
    ) {
        try {
            Authentication authentication =
                authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(
                        request.email().trim()
                            .toLowerCase(Locale.ROOT),
                        request.password()
                    )
                );

            String token = jwtService.createToken(authentication);

            return new LoginResponse(
                token,
                "Bearer",
                jwtService.getAccessTokenExpirationSeconds()
            );

        } catch (AuthenticationException exception) {
            throw new ResponseStatusException(
                HttpStatus.UNAUTHORIZED,
                "Invalid email or password"
            );
        }
    }

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public LoginResponse register(
            @Valid @RequestBody RegisterRequest request
    ) {
        accountService.registerMember(request);

        Authentication authentication = authenticationManager.authenticate(
            new UsernamePasswordAuthenticationToken(
                request.email().trim().toLowerCase(Locale.ROOT),
                request.password()
            )
        );
        String token = jwtService.createToken(authentication);

        return new LoginResponse(
            token,
            "Bearer",
            jwtService.getAccessTokenExpirationSeconds()
        );
    }

    @PostMapping("/change-password")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void changePassword(
            @Valid @RequestBody ChangePasswordRequest request,
            @AuthenticationPrincipal Jwt jwt
    ) {
        accountService.changeOwnPassword(jwt.getSubject(), request);
    }

    @GetMapping("/me")
    public Map<String, Object> me(
            @AuthenticationPrincipal Jwt jwt
    ) {
        return Map.of(
            "email", jwt.getSubject(),
            "roles", jwt.getClaimAsStringList("roles")
        );
    }
}
