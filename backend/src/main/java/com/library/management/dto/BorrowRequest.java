package com.library.management.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

public record BorrowRequest(
    @NotNull
    @Positive
    Long bookId,

    @NotNull
    @Positive
    Long memberId
) {
    
}
