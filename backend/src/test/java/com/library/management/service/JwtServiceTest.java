
package com.library.management.service;

import org.junit.jupiter.api.Test;

import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.FactorGrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.*;

import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import java.security.SecureRandom;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class JwtServiceTest {

    @Test
    void shouldGenerateValidAdminToken() {

        byte[] bytes = new byte[32];
        new SecureRandom().nextBytes(bytes);

        SecretKey key =
            new SecretKeySpec(bytes, "HmacSHA256");

        JwtEncoder encoder =
            NimbusJwtEncoder.withSecretKey(key)
                .algorithm(MacAlgorithm.HS256)
                .build();

        JwtService service =
            new JwtService(encoder, "library-management", 30);

        var authentication =
            new UsernamePasswordAuthenticationToken(
                "admin@library.local",
                null,
                List.of(
                    new SimpleGrantedAuthority("ROLE_ADMIN")
                )
            );

        String token = service.createToken(authentication);

        NimbusJwtDecoder decoder =
            NimbusJwtDecoder.withSecretKey(key)
                .macAlgorithm(MacAlgorithm.HS256)
                .build();

        decoder.setJwtValidator(
            JwtValidators.createDefaultWithIssuer(
                "library-management"
            )
        );

        Jwt jwt = decoder.decode(token);

        assertEquals(
            "admin@library.local",
            jwt.getSubject()
        );

        assertEquals(
            List.of("ADMIN"),
            jwt.getClaimAsStringList("roles")
        );

        assertNotNull(jwt.getExpiresAt());
    }

    @Test
    void shouldExcludeNonRoleAuthoritiesSuchAsFactorPassword() {

        byte[] bytes = new byte[32];
        new SecureRandom().nextBytes(bytes);

        SecretKey key =
            new SecretKeySpec(bytes, "HmacSHA256");

        JwtEncoder encoder =
            NimbusJwtEncoder.withSecretKey(key)
                .algorithm(MacAlgorithm.HS256)
                .build();

        JwtService service =
            new JwtService(encoder, "library-management", 30);

        var authentication =
            new UsernamePasswordAuthenticationToken(
                "admin@library.local",
                null,
                List.of(
                    new SimpleGrantedAuthority("ROLE_ADMIN"),
                    FactorGrantedAuthority.fromAuthority(
                        FactorGrantedAuthority.PASSWORD_AUTHORITY
                    )
                )
            );

        String token = service.createToken(authentication);

        NimbusJwtDecoder decoder =
            NimbusJwtDecoder.withSecretKey(key)
                .macAlgorithm(MacAlgorithm.HS256)
                .build();

        decoder.setJwtValidator(
            JwtValidators.createDefaultWithIssuer(
                "library-management"
            )
        );

        Jwt jwt = decoder.decode(token);

        assertEquals(
            List.of("ADMIN"),
            jwt.getClaimAsStringList("roles")
        );
        assertEquals(1800L, service.getAccessTokenExpirationSeconds());
    }
}
