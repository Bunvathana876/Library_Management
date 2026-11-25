package com.library.management.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateMemberRequest(
    @NotBlank(message = "Full name is required")
    @Size(max = 120)
    String fullName,

    @NotBlank(message = "Email is required")
    @Email(message = "Email must be valid")
    @Size(max = 254)
    String email,

    @Size(max = 30, message = "Phone number must not exceed 30 characters")
    String phone,

    @Size(max = 500, message = "Notes must not exceed 500 characters")
    String notes
) {
    public CreateMemberRequest(String fullName, String email) {
        this(fullName, email, null, null);
    }
}
