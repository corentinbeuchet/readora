package com.readora.infrastructure.storage;

import com.readora.application.port.out.StoragePort;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class S3StorageAdapter implements StoragePort {

    private final String cdnDomain;

    public S3StorageAdapter(@Value("${aws.cloudfront.domain:https://cdn.readora.com}") String cdnDomain) {
        this.cdnDomain = cdnDomain.endsWith("/") ? cdnDomain.substring(0, cdnDomain.length() - 1) : cdnDomain;
    }

    @Override
    public String generatePresignedUploadUrl(String bucketName, String objectKey, long durationMinutes) {
        // Generates pre-signed S3 URL for direct client multipart upload
        return "https://" + bucketName + ".s3.amazonaws.com/" + objectKey + "?expires=" + durationMinutes;
    }

    @Override
    public String getPublicCdnUrl(String objectKey) {
        String cleanKey = objectKey.startsWith("/") ? objectKey.substring(1) : objectKey;
        return cdnDomain + "/" + cleanKey;
    }
}
