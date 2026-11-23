
package com.library.management.service;

import com.library.management.model.AppUser;
import com.library.management.repository.AppUserRepository;

import org.springframework.security.core.userdetails.*;
import org.springframework.stereotype.Service;

import java.util.Locale;

@Service
public class DatabaseUserDetailsService
        implements UserDetailsService {

    private final AppUserRepository users;

    public DatabaseUserDetailsService(AppUserRepository users) {
        this.users = users;
    }

    @Override
    public UserDetails loadUserByUsername(String email)
            throws UsernameNotFoundException {

        String normalizedEmail = email == null
            ? ""
            : email.trim().toLowerCase(Locale.ROOT);

        AppUser user = users.findByEmail(normalizedEmail)
            .orElseThrow(() ->
                new UsernameNotFoundException(
                    "Invalid credentials"
                )
            );

        return User.withUsername(user.getEmail())
            .password(user.getPasswordHash())
            .roles(user.getRole().name())
            .disabled(!user.isEnabled())
            .build();
    }
}
