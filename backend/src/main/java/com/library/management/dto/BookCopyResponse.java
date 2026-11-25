package com.library.management.dto;

import com.library.management.model.BookCopy;
import com.library.management.model.BookCopyStatus;

import java.time.Instant;

public record BookCopyResponse(
    Long id,
    Long bookId,
    String barcode,
    BookCopyStatus status,
    String shelfLocation,
    String conditionNotes,
    Instant createdAt
) {
    public static BookCopyResponse from(BookCopy copy) {
        return new BookCopyResponse(
            copy.getId(),
            copy.getBook().getId(),
            copy.getBarcode(),
            copy.getStatus(),
            copy.getShelfLocation(),
            copy.getConditionNotes(),
            copy.getCreatedAt()
        );
    }
}
