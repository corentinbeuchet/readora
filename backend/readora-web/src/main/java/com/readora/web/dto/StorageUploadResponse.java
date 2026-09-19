package com.readora.web.dto;

import org.jspecify.annotations.Nullable;

/// @param liteCdnUrl the data-saver copy of an uploaded image (US-07), `null` when none was made
public record StorageUploadResponse(
        String storageKey,
        String cdnUrl,
        @Nullable String liteCdnUrl
) {}
