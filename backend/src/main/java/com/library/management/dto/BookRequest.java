package com.library.management.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

public record BookRequest (

    @NotBlank (message = "Title is required")
    @Size (max = 200, message = "Title is too long")
    String title,

    @NotBlank(message = "Author is required")
    @Size(max = 150, message = "Author is too long")
    String author,

    @NotNull(message = "Publication year is required")
    @Positive(message = "Publication year must be positive")
    Integer publicationYear,

    @Size(max = 20, message = "ISBN is too long")
    @Pattern(regexp = "^$|^[0-9Xx\\-\\s]{10,20}$", message = "ISBN must be a valid ISBN-10 or ISBN-13")
    String isbn,

    @Size(max = 150, message = "Publisher is too long")
    String publisher,

    @Size(max = 500, message = "Cover URL is too long")
    @Pattern(regexp = "^$|^https?://\\S+$|^/\\S+$", message = "Cover URL must be an http(s) or relative URL")
    String coverUrl
) {
    public BookRequest(String title, String author, Integer publicationYear) {
        this(title, author, publicationYear, null, null, null);
    }
}
