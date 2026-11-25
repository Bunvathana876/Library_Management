package com.library.management.dto;

import com.library.management.model.BookCopyStatus;
import jakarta.validation.constraints.Size;

public record BookCopyRequest(
    @Size(max = 64, message = "Copy barcode must not exceed 64 characters")
    String barcode,

    @Size(max = 60, message = "Shelf location must not exceed 60 characters")
    String shelfLocation,

    @Size(max = 255, message = "Condition notes must not exceed 255 characters")
    String conditionNotes,

    BookCopyStatus status
) {}
