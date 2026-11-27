package com.library.management.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

/** The borrower is always resolved from the authenticated account. */
public record SelfBorrowRequest(@NotNull @Positive Long bookId) {}
