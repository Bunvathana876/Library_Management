package com.library.management.service;

import com.library.management.dto.AccountResponse;
import com.library.management.dto.ChangePasswordRequest;
import com.library.management.dto.CreateAccountRequest;
import com.library.management.dto.RegisterRequest;
import com.library.management.exception.BusinessRuleException;
import com.library.management.exception.ResourceNotFoundException;
import com.library.management.model.AppUser;
import com.library.management.model.UserRole;
import com.library.management.repository.AppUserRepository;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Locale;

@Service
public class AccountService {

    private final AppUserRepository users;
    private final PasswordEncoder encoder;
    private final MemberService memberService;

    public AccountService(
            AppUserRepository users,
            PasswordEncoder encoder,
            MemberService memberService
    ) {
        this.users = users;
        this.encoder = encoder;
        this.memberService = memberService;
    }

    @Transactional
    public AccountResponse create(CreateAccountRequest request) {
        if (request.role() == UserRole.ADMIN) {
            throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "Admin accounts cannot be created here"
            );
        }

        String email = normalizeEmail(request.email());

        if (users.existsByEmail(email)) {
            throw new BusinessRuleException("An account with this email already exists");
        }

        AppUser user = new AppUser(
            email,
            encoder.encode(request.password()),
            request.role()
        );

        AppUser saved = users.save(user);

        if (saved.getRole() == UserRole.MEMBER) {
            memberService.ensureMemberForEmail(email, request.fullName());
        }

        return toResponse(saved);
    }

    @Transactional
    public AccountResponse registerMember(RegisterRequest request) {
        String email = normalizeEmail(request.email());
        if (users.existsByEmail(email)) {
            throw new BusinessRuleException("An account with this email already exists");
        }

        AppUser user = new AppUser(
            email,
            encoder.encode(request.password()),
            UserRole.MEMBER
        );

        AppUser saved = users.save(user);
        memberService.ensureMemberForEmail(email, request.fullName());
        return toResponse(saved);
    }

    @Transactional
    public void changeOwnPassword(String rawEmail, ChangePasswordRequest request) {
        String email = normalizeEmail(rawEmail);
        AppUser user = users.findByEmail(email)
            .orElseThrow(() -> new ResourceNotFoundException("Account not found for " + email));

        if (!encoder.matches(request.currentPassword(), user.getPasswordHash())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Current password is incorrect");
        }

        user.setPasswordHash(encoder.encode(request.newPassword()));
        users.save(user);
    }

    @Transactional
    public AccountResponse updateStatus(Long id, boolean enabled, String actorEmail) {
        AppUser user = users.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Account", id));

        if (!enabled) {
            if (actorEmail != null && user.getEmail().equalsIgnoreCase(actorEmail.trim())) {
                throw new BusinessRuleException("You cannot disable your own active administrator account");
            }
            if (user.getRole() == UserRole.ADMIN && users.countByRoleAndEnabledTrue(UserRole.ADMIN) <= 1) {
                throw new BusinessRuleException("At least one active administrator account must remain enabled");
            }
        }

        user.setEnabled(enabled);
        return toResponse(users.save(user));
    }

    @Transactional
    public AccountResponse updateRole(Long id, UserRole role, String actorEmail) {
        if (role == UserRole.ADMIN) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Admin role cannot be assigned here");
        }

        AppUser user = users.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Account", id));

        if (user.getRole() == UserRole.ADMIN
                || (actorEmail != null && user.getEmail().equalsIgnoreCase(actorEmail.trim()))) {
            throw new BusinessRuleException("Administrator account role cannot be modified");
        }

        user.setRole(role);
        AppUser saved = users.save(user);
        if (role == UserRole.MEMBER) {
            memberService.ensureMemberForEmail(saved.getEmail(), null);
        }
        return toResponse(saved);
    }

    @Transactional
    public void resetPassword(Long id, String newPassword) {
        AppUser user = users.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Account", id));
        user.setPasswordHash(encoder.encode(newPassword));
        users.save(user);
    }

    @Transactional(readOnly = true)
    public List<AccountResponse> getAllUsers() {
        return users.findAll(Sort.by("id"))
            .stream()
            .map(AccountService::toResponse)
            .toList();
    }

    private static AccountResponse toResponse(AppUser u) {
        return new AccountResponse(u.getId(), u.getEmail(), u.getRole(), u.isEnabled());
    }

    private static String normalizeEmail(String rawEmail) {
        return rawEmail == null ? "" : rawEmail.trim().toLowerCase(Locale.ROOT);
    }
}
