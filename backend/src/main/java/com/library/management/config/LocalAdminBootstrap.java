
package com.library.management.config;

import com.library.management.model.AppUser;
import com.library.management.model.UserRole;
import com.library.management.repository.AppUserRepository;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Locale;

@Configuration
@Profile("local")
public class LocalAdminBootstrap {

    @Bean
    ApplicationRunner createLocalAdmin(
            AppUserRepository users,
            PasswordEncoder encoder,
            @Value("${app.bootstrap.admin.email}") String email,
            @Value("${app.bootstrap.admin.password}") String password
    ) {
        return args -> {

            if (users.existsByRole(UserRole.ADMIN)) {
                return;
            }

            if (email.isBlank() || password.length() < 12) {
                throw new IllegalStateException(
                    "Set a local admin email and a password of at least 12 characters"
                );
            }

            String normalizedEmail =
                email.trim().toLowerCase(Locale.ROOT);

            AppUser admin = new AppUser(
                normalizedEmail,
                encoder.encode(password),
                UserRole.ADMIN
            );

            users.save(admin);

            System.out.println(
                "Local administrator created successfully"
            );
        };
    }
}
