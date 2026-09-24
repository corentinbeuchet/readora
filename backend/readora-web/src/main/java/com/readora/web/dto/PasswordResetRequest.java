package com.readora.web.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.jspecify.annotations.Nullable;

/// Asks for a reset link (US-15). `language` is the site's (`en` by default): the email and its link speak it.
public record PasswordResetRequest(
        @NotBlank(message = "Email cannot be blank")
        @Size(max = 255, message = "Email must be at most 255 characters")
        String email,

        @Pattern(regexp = "en|fr", message = "Language must be en or fr")
        @Nullable String language
) {
}
