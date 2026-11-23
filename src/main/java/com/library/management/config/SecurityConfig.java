
package com.library.management.config;

import jakarta.servlet.DispatcherType;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;

import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.ProviderManager;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;

import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;

import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.oauth2.server.resource.authentication.JwtGrantedAuthoritiesConverter;

import org.springframework.security.web.SecurityFilterChain;

@Configuration
public class SecurityConfig {

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public AuthenticationManager authenticationManager(
            UserDetailsService userDetailsService,
            PasswordEncoder passwordEncoder
    ) {
        DaoAuthenticationProvider provider =
            new DaoAuthenticationProvider(userDetailsService);

        provider.setPasswordEncoder(passwordEncoder);

        return new ProviderManager(provider);
    }

    @Bean
    public JwtAuthenticationConverter jwtAuthenticationConverter() {

        JwtGrantedAuthoritiesConverter roles =
            new JwtGrantedAuthoritiesConverter();

        roles.setAuthoritiesClaimName("roles");
        roles.setAuthorityPrefix("ROLE_");

        JwtAuthenticationConverter converter =
            new JwtAuthenticationConverter();

        converter.setJwtGrantedAuthoritiesConverter(roles);

        return converter;
    }

    @Bean
    public SecurityFilterChain securityFilterChain(
            HttpSecurity http,
            JwtAuthenticationConverter jwtConverter
    ) throws Exception {

        http
            .csrf(csrf -> csrf.disable())

            .sessionManagement(session ->
                session.sessionCreationPolicy(
                    SessionCreationPolicy.STATELESS
                )
            )

            .authorizeHttpRequests(auth -> auth

                // Allow internal error dispatches so real HTTP error statuses (400, 404, 405, etc.) are returned
                .dispatcherTypeMatchers(DispatcherType.ERROR).permitAll()

                // Public login
                .requestMatchers(
                    HttpMethod.POST, "/api/auth/login"
                ).permitAll()

                // Public book catalog
                .requestMatchers(
                    HttpMethod.GET,
                    "/api/books",
                    "/api/books/**"
                ).permitAll()

                // Logged-in users
                .requestMatchers(
                    HttpMethod.GET, "/api/auth/me"
                ).authenticated()

                // Admin only
                .requestMatchers("/api/admin/**")
                    .hasRole("ADMIN")

                // Admin and librarian
                .requestMatchers(
                    "/api/books",
                    "/api/books/**",
                    "/api/members",
                    "/api/members/**",
                    "/api/loans",
                    "/api/loans/**"
                ).hasAnyRole("ADMIN", "LIBRARIAN")

                // Deny anything not explicitly configured
                .anyRequest().denyAll()
            )

            .httpBasic(basic -> basic.disable())
            .formLogin(form -> form.disable())

            .oauth2ResourceServer(oauth ->
                oauth.jwt(jwt ->
                    jwt.jwtAuthenticationConverter(jwtConverter)
                )
            );

        return http.build();
    }
}
