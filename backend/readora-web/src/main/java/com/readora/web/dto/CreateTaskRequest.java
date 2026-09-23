package com.readora.web.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.util.List;

/// A chapter put on the task board with its raw pages (images already uploaded through `POST /storage/upload`).
public record CreateTaskRequest(
        @NotNull(message = "Chapter number cannot be null")
        @Positive(message = "Chapter number must be positive")
        BigDecimal chapterNumber,

        @NotEmpty(message = "Upload at least one page")
        @Size(max = 500, message = "A chapter cannot have more than 500 pages")
        List<@Valid PageAssetDto> pages
) {
}
