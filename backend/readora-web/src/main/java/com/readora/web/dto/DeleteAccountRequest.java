package com.readora.web.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/// The reader's password, to delete the account (US-15).
public record DeleteAccountRequest(
        @NotBlank(message = "Type your password")
        @Size(max = 72, message = "Password must be between 8 and 72 characters")
        String password
) {
}
