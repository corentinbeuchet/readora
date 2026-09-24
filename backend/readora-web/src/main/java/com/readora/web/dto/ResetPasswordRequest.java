package com.readora.web.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/// The token from the reset link and the new password (US-15).
public record ResetPasswordRequest(
        @NotBlank(message = "The reset link is incomplete")
        @Size(max = 200, message = "The reset link is incomplete")
        String token,

        @NotBlank(message = "Password cannot be blank")
        @Size(min = 8, max = 72, message = "Password must be between 8 and 72 characters")
        String newPassword
) {
}
