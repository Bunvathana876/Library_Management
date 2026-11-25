package com.library.management.dto;

import com.library.management.model.Hold;
import com.library.management.model.HoldStatus;

import java.time.Instant;
import java.time.LocalDate;

public record HoldResponse(
    Long id,
    Long bookId,
    String bookTitle,
    String bookAuthor,
    String bookIsbn,
    String bookCoverUrl,
    String copyBarcode,
    Long memberId,
    String memberName,
    String memberEmail,
    HoldStatus status,
    int queuePosition,
    Instant placedAt,
    Instant readyAt,
    LocalDate expiresOn
) {
    public static HoldResponse from(Hold hold, int queuePosition) {
        return new HoldResponse(
            hold.getId(),
            hold.getBook().getId(),
            hold.getBook().getTitle(),
            hold.getBook().getAuthor(),
            hold.getBook().getIsbn(),
            hold.getBook().getCoverUrl(),
            hold.getCopy() != null ? hold.getCopy().getBarcode() : null,
            hold.getMember().getId(),
            hold.getMember().getFullName(),
            hold.getMember().getEmail(),
            hold.getStatus(),
            queuePosition,
            hold.getPlacedAt(),
            hold.getReadyAt(),
            hold.getExpiresOn()
        );
    }
}
