package com.readora.web.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.math.BigDecimal;

public record CreateTaskRequest(
        @NotNull(message = "Chapter number cannot be null")
        @Positive(message = "Chapter number must be positive")
        BigDecimal chapterNumber,

        @NotBlank(message = "Asset URL cannot be blank")
        String assetUrl,

        @Positive(message = "Page count must be greater than 0")
        int pageCount
) {
}
