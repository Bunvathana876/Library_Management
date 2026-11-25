
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

                .requestMatchers(
                    HttpMethod.GET,
                    "/v3/api-docs",
                    "/v3/api-docs/**",
                    "/swagger-ui.html",
                    "/swagger-ui/**"
                ).permitAll()

                // Public authentication
                .requestMatchers(
                    HttpMethod.POST, "/api/auth/login", "/api/auth/register"
                ).permitAll()
                .requestMatchers(
                    HttpMethod.POST, "/api/auth/change-password"
                ).authenticated()

                .requestMatchers(
                    HttpMethod.GET,
                    "/actuator/health",
                    "/actuator/health/**"
                ).permitAll()

                // Staff-only ISBN metadata lookup (must precede public GET /api/books/**)
                .requestMatchers(
                    HttpMethod.GET,
                    "/api/books/isbn/**"
                ).hasAnyRole("ADMIN", "LIBRARIAN")

                // Public book catalog
                .requestMatchers(
                    HttpMethod.GET,
                    "/api/books",
                    "/api/books/**"
                ).permitAll()

                // Logged-in users (member self-service & holds)
                .requestMatchers(
                    HttpMethod.GET, "/api/auth/me"
                ).authenticated()
                .requestMatchers("/api/me/**").authenticated()
                .requestMatchers(HttpMethod.POST, "/api/holds").authenticated()
                .requestMatchers(HttpMethod.POST, "/api/holds/*/cancel").authenticated()

                // Staff-only hold desk management
                .requestMatchers("/api/holds/**")
                    .hasAnyRole("ADMIN", "LIBRARIAN")

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
