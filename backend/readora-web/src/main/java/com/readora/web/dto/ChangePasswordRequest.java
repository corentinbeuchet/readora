package com.readora.web.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/// The signed-in reader's current password and the new one (US-15).
public record ChangePasswordRequest(
        @NotBlank(message = "Type your current password")
        @Size(max = 72, message = "Password must be between 8 and 72 characters")
        String currentPassword,

        @NotBlank(message = "Password cannot be blank")
        @Size(min = 8, max = 72, message = "Password must be between 8 and 72 characters")
        String newPassword
) {
}
