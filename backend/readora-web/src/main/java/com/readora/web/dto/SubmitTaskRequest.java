package com.readora.web.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;


public record SubmitTaskRequest(
        @NotBlank(message = "Asset package URL cannot be blank")
        @Size(max = 1024, message = "Asset URL must not exceed 1024 characters")
        String assetUrl,

        @Positive(message = "Page count must be greater than 0")
        @Max(value = 1000, message = "Page count cannot exceed 1000")
        int pageCount
) {
}
