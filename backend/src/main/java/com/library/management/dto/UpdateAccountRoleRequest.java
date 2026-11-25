package com.library.management.dto;

import com.library.management.model.UserRole;
import jakarta.validation.constraints.NotNull;

public record UpdateAccountRoleRequest(
    @NotNull(message = "Role is required")
    UserRole role
) {}
