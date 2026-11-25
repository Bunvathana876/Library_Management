package com.library.management.dto;

import jakarta.validation.constraints.NotNull;

public record UpdateMemberStatusRequest(
    @NotNull(message = "Active status is required")
    Boolean active
) {}
