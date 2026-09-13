package com.readora.domain.work;

import com.readora.domain.common.DomainValidationException;
import java.io.Serializable;
import java.util.Objects;

public record PageAsset(
        int pageNumber,
        String storageKey,
        String cdnUrl,
        int width,
        int height
) implements Serializable {
    public PageAsset {
        if (pageNumber < 1) {
            throw new DomainValidationException("Page number must be >= 1");
        }
        Objects.requireNonNull(storageKey, "Storage key cannot be null");
    }

    public static PageAsset create(int pageNumber, String storageKey, String cdnUrl) {
        return new PageAsset(pageNumber, storageKey, cdnUrl, 0, 0);
    }
}
