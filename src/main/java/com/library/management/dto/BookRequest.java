package com.library.management.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
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
    Integer publicationYear
) {}
