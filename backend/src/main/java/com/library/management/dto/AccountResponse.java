
package com.library.management.dto;

import com.library.management.model.UserRole;

public record AccountResponse(
    Long id,
    String email,
    UserRole role
) {}
