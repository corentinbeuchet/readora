package com.readora.web.dto;

import jakarta.validation.constraints.NotBlank;

public record CheckoutRequest(
        @NotBlank(message = "Plan cannot be blank")
        String plan
) {
}
