package com.readora.web.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

import java.util.UUID;

public record UpdateProgressRequest(
        @NotNull(message = "Chapter ID cannot be null")
        UUID chapterId,

        @Min(value = 1, message = "Page index must be at least 1")
        int pageIndex
) {
}
