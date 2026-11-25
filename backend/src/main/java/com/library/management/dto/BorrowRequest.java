package com.library.management.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

public record BorrowRequest(
    @NotNull
    @Positive
    Long bookId,

    @NotNull
    @Positive
    Long memberId,

    @Positive
    Long copyId
) {
    public BorrowRequest(Long bookId, Long memberId) {
        this(bookId, memberId, null);
    }
}
