package com.readora.web.dto;

import com.readora.domain.work.PageAsset;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import org.jspecify.annotations.Nullable;

/// @param description optional text for screen readers (US-07)
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
        int height,

        @Size(max = PageAsset.MAX_DESCRIPTION_LENGTH, message = "A page description must not exceed 500 characters")
        @Nullable String description
) {
    public PageAssetDto(int pageNumber, String storageKey, @Nullable String cdnUrl, int width, int height) {
        this(pageNumber, storageKey, cdnUrl, width, height, null);
    }

    public static PageAssetDto fromDomain(PageAsset page) {
        return new PageAssetDto(page.pageNumber(), page.storageKey(), page.cdnUrl(), page.width(), page.height(), page.description());
    }

    public PageAsset toDomain() {
        return new PageAsset(pageNumber, storageKey, cdnUrl, width, height, description);
    }
}
