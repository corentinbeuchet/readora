package com.readora.application.port.out;

public interface StoragePort {
    String generatePresignedUploadUrl(String bucketName, String objectKey, long durationMinutes);
    String getPublicCdnUrl(String objectKey);
}
