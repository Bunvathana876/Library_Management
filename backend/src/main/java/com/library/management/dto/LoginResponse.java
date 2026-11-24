
package com.library.management.dto;

public record LoginResponse(
    String accessToken,
    String tokenType,
    long expiresInSeconds
) {}
