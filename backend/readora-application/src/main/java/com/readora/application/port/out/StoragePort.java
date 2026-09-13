package com.readora.application.port.out;

import java.util.Optional;

public interface StoragePort {
    String generatePresignedUploadUrl(String bucketName, String objectKey, long durationMinutes);
    String getPublicCdnUrl(String objectKey);
    default void storeAsset(String objectKey, byte[] data, String contentType) {}
    default Optional<byte[]> loadAsset(String objectKey) { return Optional.empty(); }
    default String getContentType(String objectKey) { return "application/octet-stream"; }
}
