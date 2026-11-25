package com.library.management.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

public record CreateHoldRequest(
    @NotNull
    @Positive
    Long bookId,

    @Positive
    Long memberId
) {}
