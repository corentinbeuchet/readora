package com.readora.web.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

/// How long an admin keeps an account out (US-16).
public record SuspendAccountRequest(
        @Min(value = 1, message = "A suspension lasts 1 to 365 days")
        @Max(value = 365, message = "A suspension lasts 1 to 365 days")
        int days
) {
}
