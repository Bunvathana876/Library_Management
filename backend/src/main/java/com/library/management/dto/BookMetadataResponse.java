package com.library.management.dto;

public record BookMetadataResponse(
    String isbn,
    String title,
    String author,
    Integer publicationYear,
    String publisher,
    String coverUrl,
    String source
) {}
