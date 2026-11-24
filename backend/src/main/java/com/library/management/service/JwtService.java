
package com.library.management.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.*;

import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;

@Service
public class JwtService {

    private final JwtEncoder encoder;
    private final String issuer;
    private final long tokenMinutes;

    public JwtService(
            JwtEncoder encoder,
            @Value("${app.jwt.issuer}") String issuer,
            @Value("${app.jwt.access-token-minutes:30}")
            long tokenMinutes
    ) {
        this.encoder = encoder;
        this.issuer = issuer;
        this.tokenMinutes = tokenMinutes;
    }

    public String createToken(Authentication authentication) {

        Instant now = Instant.now();

        List<String> roles = authentication.getAuthorities()
            .stream()
            .map(GrantedAuthority::getAuthority)
            .filter(authority -> authority != null && authority.startsWith("ROLE_"))
            .map(role -> role.substring("ROLE_".length()))
            .toList();

        JwtClaimsSet claims = JwtClaimsSet.builder()
            .issuer(issuer)
            .subject(authentication.getName())
            .issuedAt(now)
            .expiresAt(now.plus(tokenMinutes, ChronoUnit.MINUTES))
            .claim("roles", roles)
            .build();

        JwsHeader header = JwsHeader
            .with(MacAlgorithm.HS256)
            .build();

        return encoder.encode(
            JwtEncoderParameters.from(header, claims)
        ).getTokenValue();
    }

    public long getAccessTokenExpirationSeconds() {
        return tokenMinutes * 60;
    }
}
