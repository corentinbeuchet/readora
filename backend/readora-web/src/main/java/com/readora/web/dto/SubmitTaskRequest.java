package com.readora.web.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;

public record SubmitTaskRequest(
        @NotBlank(message = "Asset package URL cannot be blank")
        String assetUrl,

        @Positive(message = "Page count must be greater than 0")
        int pageCount
) {
}
