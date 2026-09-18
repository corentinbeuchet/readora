package com.readora.web.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import org.jspecify.annotations.Nullable;

public record PageAssetDto(
        @Positive(message = "Page number must be at least 1")
        int pageNumber,

        @NotBlank(message = "Page storage key is required")
        @Size(max = 1024, message = "Page storage key must not exceed 1024 characters")
        String storageKey,

        @Size(max = 1024, message = "Page URL must not exceed 1024 characters")
        @Pattern(regexp = "^$|^https?://\\S+$|^/api/v1/storage/assets/\\S+$", message = "Page URL must be an http(s) URL or an uploaded asset path")
        @Nullable String cdnUrl,

        @PositiveOrZero(message = "Width cannot be negative")
        int width,

        @PositiveOrZero(message = "Height cannot be negative")
        int height
) {
}
