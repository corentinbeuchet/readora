package com.readora.infrastructure.storage;

import com.readora.application.port.out.StoragePort;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import software.amazon.awssdk.core.ResponseBytes;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;
import software.amazon.awssdk.services.s3.model.NoSuchKeyException;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.PresignedPutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.model.PutObjectPresignRequest;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.Duration;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class S3StorageAdapter implements StoragePort {

    private static final Logger log = LoggerFactory.getLogger(S3StorageAdapter.class);

    private final S3Client s3Client;
    private final S3Presigner s3Presigner;
    private final String defaultBucketName;
    private final String cdnDomain;
    private final Path localStorageDir;
    private final Map<String, byte[]> inMemoryCache = new ConcurrentHashMap<>();
    private final Map<String, String> contentTypeCache = new ConcurrentHashMap<>();

    @Autowired
    public S3StorageAdapter(
            @Autowired(required = false) S3Client s3Client,
            @Autowired(required = false) S3Presigner s3Presigner,
            @Value("${aws.s3.bucket-name:readora-media-dev}") String defaultBucketName,
            @Value("${aws.cloudfront.domain:}") String cdnDomain,
            @Value("${aws.storage.local-dir:}") String localDir
    ) {
        this.s3Client = s3Client;
        this.s3Presigner = s3Presigner;
        this.defaultBucketName = (defaultBucketName != null && !defaultBucketName.isBlank())
                ? defaultBucketName.trim()
                : "readora-media-dev";

        String trimmed = cdnDomain != null ? cdnDomain.trim() : "";
        if (trimmed.endsWith("/")) {
            trimmed = trimmed.substring(0, trimmed.length() - 1);
        }
        this.cdnDomain = trimmed;

        Path dir;
        if (localDir != null && !localDir.isBlank()) {
            dir = Paths.get(localDir);
        } else {
            dir = Paths.get(System.getProperty("java.io.tmpdir"), "readora-storage");
        }
        this.localStorageDir = dir;
        try {
            Files.createDirectories(this.localStorageDir);
        } catch (IOException e) {
            log.warn("Could not create local storage directory {}: {}", this.localStorageDir, e.getMessage());
        }
    }

    @Override
    public String generatePresignedUploadUrl(String objectKey, Duration validity) {
        String cleanKey = objectKey.startsWith("/") ? objectKey.substring(1) : objectKey;

        if (s3Presigner != null) {
            try {
                PutObjectPresignRequest presignRequest = PutObjectPresignRequest.builder()
                        .signatureDuration(validity)
                        .putObjectRequest(PutObjectRequest.builder()
                                .bucket(defaultBucketName)
                                .key(cleanKey)
                                .build())
                        .build();
                PresignedPutObjectRequest presigned = s3Presigner.presignPutObject(presignRequest);
                return presigned.url().toString();
            } catch (Exception e) {
                log.warn("Could not generate presigned S3 URL for {}: {}", cleanKey, e.getMessage());
            }
        }
        return "https://" + defaultBucketName + ".s3.amazonaws.com/" + cleanKey + "?expires=" + validity.toMinutes();
    }

    @Override
    public String getPublicCdnUrl(String objectKey) {
        String cleanKey = objectKey.startsWith("/") ? objectKey.substring(1) : objectKey;
        if (cdnDomain.isEmpty()) {
            return "/api/v1/storage/assets/" + cleanKey;
        }
        return cdnDomain + "/" + cleanKey;
    }

    @Override
    public void storeAsset(String objectKey, byte[] data, String contentType) {
        String cleanKey = objectKey.startsWith("/") ? objectKey.substring(1) : objectKey;
        inMemoryCache.put(cleanKey, data);
        if (contentType != null && !contentType.isBlank()) {
            contentTypeCache.put(cleanKey, contentType);
        }
        try {
            Path targetPath = localStorageDir.resolve(cleanKey).normalize();
            if (targetPath.startsWith(localStorageDir)) {
                if (targetPath.getParent() != null) {
                    Files.createDirectories(targetPath.getParent());
                }
                Files.write(targetPath, data);
            }
        } catch (IOException e) {
            log.warn("Failed to persist asset {} to disk: {}", cleanKey, e.getMessage());
        }

        if (s3Client != null) {
            try {
                PutObjectRequest.Builder reqBuilder = PutObjectRequest.builder()
                        .bucket(defaultBucketName)
                        .key(cleanKey);
                if (contentType != null && !contentType.isBlank()) {
                    reqBuilder.contentType(contentType);
                }
                s3Client.putObject(reqBuilder.build(), RequestBody.fromBytes(data));
                log.debug("Successfully stored asset {} to S3/MinIO bucket {}", cleanKey, defaultBucketName);
            } catch (Exception e) {
                log.warn("Could not upload asset {} to S3/MinIO bucket {}: {}", cleanKey, defaultBucketName, e.getMessage());
            }
        }
    }

    @Override
    public Optional<byte[]> loadAsset(String objectKey) {
        String cleanKey = objectKey.startsWith("/") ? objectKey.substring(1) : objectKey;
        byte[] cached = inMemoryCache.get(cleanKey);
        if (cached != null) {
            return Optional.of(cached);
        }
        try {
            Path targetPath = localStorageDir.resolve(cleanKey).normalize();
            if (targetPath.startsWith(localStorageDir) && Files.exists(targetPath)) {
                byte[] bytes = Files.readAllBytes(targetPath);
                inMemoryCache.put(cleanKey, bytes);
                return Optional.of(bytes);
            }
        } catch (IOException e) {
            log.warn("Failed to read asset {} from disk: {}", cleanKey, e.getMessage());
        }

        if (s3Client != null) {
            try {
                ResponseBytes<GetObjectResponse> responseBytes = s3Client.getObjectAsBytes(
                        GetObjectRequest.builder()
                                .bucket(defaultBucketName)
                                .key(cleanKey)
                                .build()
                );
                byte[] data = responseBytes.asByteArray();
                inMemoryCache.put(cleanKey, data);
                if (responseBytes.response().contentType() != null) {
                    contentTypeCache.put(cleanKey, responseBytes.response().contentType());
                }
                return Optional.of(data);
            } catch (NoSuchKeyException e) {
                log.debug("Asset {} not found in S3/MinIO bucket {}", cleanKey, defaultBucketName);
            } catch (Exception e) {
                log.warn("Could not retrieve asset {} from S3/MinIO bucket {}: {}", cleanKey, defaultBucketName, e.getMessage());
            }
        }

        return Optional.empty();
    }

    @Override
    public String getContentType(String objectKey) {
        String cleanKey = objectKey.startsWith("/") ? objectKey.substring(1) : objectKey;
        String type = contentTypeCache.get(cleanKey);
        if (type != null) {
            return type;
        }
        String lower = cleanKey.toLowerCase();
        if (lower.endsWith(".png")) return "image/png";
        if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
        if (lower.endsWith(".webp")) return "image/webp";
        if (lower.endsWith(".gif")) return "image/gif";
        if (lower.endsWith(".avif")) return "image/avif";
        return "application/octet-stream";
    }
}
