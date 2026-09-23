package com.readora.application.port.out;

import org.jspecify.annotations.Nullable;

import java.util.Optional;

public interface StoragePort {
    String getPublicCdnUrl(String objectKey);
    void storeAsset(String objectKey, byte[] data, @Nullable String contentType);

    Optional<byte[]> loadAsset(String objectKey);

    String getContentType(String objectKey);
}
