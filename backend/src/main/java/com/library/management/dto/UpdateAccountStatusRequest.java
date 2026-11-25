package com.library.management.dto;

import jakarta.validation.constraints.NotNull;

public record UpdateAccountStatusRequest(
    @NotNull(message = "Enabled status is required")
    Boolean enabled
) {}
