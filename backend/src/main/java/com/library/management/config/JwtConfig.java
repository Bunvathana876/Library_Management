
package com.library.management.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.*;

import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import java.util.Base64;

@Configuration
public class JwtConfig {

    @Bean
    public SecretKey jwtSecretKey(
            @Value("${app.jwt.secret-base64}") String encoded
    ) {
        byte[] bytes = Base64.getDecoder().decode(encoded.trim());

        if (bytes.length < 32) {
            throw new IllegalStateException(
                "JWT secret must contain at least 32 bytes"
            );
        }

        return new SecretKeySpec(bytes, "HmacSHA256");
    }

    @Bean
    public JwtEncoder jwtEncoder(SecretKey key) {
        return NimbusJwtEncoder.withSecretKey(key)
            .algorithm(MacAlgorithm.HS256)
            .build();
    }

    @Bean
    public JwtDecoder jwtDecoder(
            SecretKey key,
            @Value("${app.jwt.issuer}") String issuer,
            com.library.management.repository.AppUserRepository users
    ) {
        NimbusJwtDecoder decoder =
            NimbusJwtDecoder.withSecretKey(key)
                .macAlgorithm(MacAlgorithm.HS256)
                .build();

        decoder.setJwtValidator(
            new org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator<>(
                JwtValidators.createDefaultWithIssuer(issuer),
                jwt -> {
                    var user = users.findByEmail(jwt.getSubject()).orElse(null);
                    if (user != null && user.isEnabled()
                            && user.getTokenVersion().equals(jwt.getClaimAsString("token_version"))
                            && java.util.List.of(user.getRole().name()).equals(jwt.getClaimAsStringList("roles"))) {
                        return org.springframework.security.oauth2.core.OAuth2TokenValidatorResult.success();
                    }
                    return org.springframework.security.oauth2.core.OAuth2TokenValidatorResult.failure(
                        new org.springframework.security.oauth2.core.OAuth2Error("invalid_token", "Account session has been revoked", null));
                }
            )
        );

        return decoder;
    }
}
