
package com.library.management.dto;

import com.library.management.model.UserRole;

import jakarta.validation.constraints.*;

public record CreateAccountRequest(

    @NotBlank
    @Email
    String email,

    @NotBlank
    @Size(min = 12, max = 72)
    String password,

    @NotNull
    UserRole role

) {}
