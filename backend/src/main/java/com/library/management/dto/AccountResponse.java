
package com.library.management.dto;

import com.library.management.model.UserRole;

public record AccountResponse(
    Long id,
    String email,
    UserRole role,
    boolean enabled
) {
    public AccountResponse(Long id, String email, UserRole role) {
        this(id, email, role, true);
    }
}
