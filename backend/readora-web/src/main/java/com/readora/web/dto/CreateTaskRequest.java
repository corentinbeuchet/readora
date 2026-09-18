package com.readora.web.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;

public record CreateTaskRequest(
        @NotNull(message = "Chapter number cannot be null")
        @Positive(message = "Chapter number must be positive")
        BigDecimal chapterNumber,

        @NotBlank(message = "Asset URL cannot be blank")
        @Size(max = 1024, message = "Asset URL must not exceed 1024 characters")
        String assetUrl,

        @Positive(message = "Page count must be greater than 0")
        @Max(value = 1000, message = "Page count cannot exceed 1000")
        int pageCount
) {
}
