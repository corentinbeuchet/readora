package com.readora.domain.work;

import com.readora.domain.common.DomainValidationException;
import org.jspecify.annotations.Nullable;
import java.io.Serializable;
import java.util.Objects;

/// One page image of a chapter.
///
/// @param description what the page shows, written by the uploader for screen-reader users (US-07); blank is
///                    stored as `null`
/// @param liteCdnUrl  a lighter copy for the reader's data saver (US-07); `null` for pages uploaded before it
///                    existed or when the copy would not have been smaller
public record PageAsset(
        int pageNumber,
        String storageKey,
        @Nullable String cdnUrl,
        int width,
        int height,
        @Nullable String description,
        @Nullable String liteCdnUrl
) implements Serializable {
    public static final int MAX_DESCRIPTION_LENGTH = 500;

    public PageAsset {
        if (pageNumber < 1) {
            throw new DomainValidationException("Page number must be >= 1");
        }
        Objects.requireNonNull(storageKey, "Storage key cannot be null");
        description = description == null || description.isBlank() ? null : description.strip();
        if (description != null && description.length() > MAX_DESCRIPTION_LENGTH) {
            throw new DomainValidationException("A page description must not exceed " + MAX_DESCRIPTION_LENGTH + " characters");
        }
    }

    public PageAsset(int pageNumber, String storageKey, @Nullable String cdnUrl, int width, int height) {
        this(pageNumber, storageKey, cdnUrl, width, height, null, null);
    }

    public static PageAsset create(int pageNumber, String storageKey, @Nullable String cdnUrl) {
        return new PageAsset(pageNumber, storageKey, cdnUrl, 0, 0);
    }

    public PageAsset withCdnUrl(String url) {
        return new PageAsset(pageNumber, storageKey, url, width, height, description, liteCdnUrl);
    }
}
