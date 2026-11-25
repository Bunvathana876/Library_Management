package com.library.management.dto;

import jakarta.validation.constraints.Size;

public record FineActionRequest(
    @Size(max = 255, message = "Note must not exceed 255 characters")
    String note
) {}
