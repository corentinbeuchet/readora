package com.readora.application.port.out;

import java.time.Duration;
import java.util.Optional;

public interface StoragePort {
    /** Presigned PUT URL for {@code objectKey} in the configured media bucket; callers never choose the bucket. */
    String generatePresignedUploadUrl(String objectKey, Duration validity);
    String getPublicCdnUrl(String objectKey);
    default void storeAsset(String objectKey, byte[] data, String contentType) {}
    default Optional<byte[]> loadAsset(String objectKey) { return Optional.empty(); }
    default String getContentType(String objectKey) { return "application/octet-stream"; }
}
