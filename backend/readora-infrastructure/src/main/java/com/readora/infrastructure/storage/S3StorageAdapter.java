package com.readora.infrastructure.storage;

import com.readora.application.port.out.StoragePort;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.NoSuchKeyException;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.PutObjectPresignRequest;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.Duration;
import java.util.Locale;
import java.util.Optional;

/// Stores media in exactly one place, decided at startup:
///
/// - **S3 mode** (an [S3Client] bean exists, i.e. `aws.s3.enabled=true`): S3/MinIO is the only store. A failed
///   write throws [StoragePort.StorageUnavailableException] instead of pretending to succeed.
/// - **Local mode** (no S3 client — dev and tests): files live under `aws.storage.local-dir`.
///
/// Nothing is cached in memory, so memory use does not grow with the number of uploads.
@Component
public class S3StorageAdapter implements StoragePort {

    private static final Logger log = LoggerFactory.getLogger(S3StorageAdapter.class);

    private final S3Client s3Client;
    private final S3Presigner s3Presigner;
    private final String defaultBucketName;
    private final String cdnDomain;
    private final Path localStorageDir;

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

        this.localStorageDir = (localDir != null && !localDir.isBlank()
                ? Paths.get(localDir)
                : Paths.get(System.getProperty("java.io.tmpdir"), "readora-storage")).toAbsolutePath().normalize();
        if (s3Client == null) {
            try {
                Files.createDirectories(this.localStorageDir);
            } catch (IOException e) {
                log.warn("Could not create local storage directory {}: {}", this.localStorageDir, e.getMessage());
            }
            log.info("Storage: local mode ({}); S3 is disabled", this.localStorageDir);
        }
    }

    @Override
    public String generatePresignedUploadUrl(String objectKey, Duration validity) {
        if (s3Presigner == null) {
            throw new StorageUnavailableException("Presigned uploads require S3 storage, which is not enabled");
        }
        String cleanKey = clean(objectKey);
        try {
            PutObjectPresignRequest presignRequest = PutObjectPresignRequest.builder()
                    .signatureDuration(validity)
                    .putObjectRequest(PutObjectRequest.builder()
                            .bucket(defaultBucketName)
                            .key(cleanKey)
                            .build())
                    .build();
            return s3Presigner.presignPutObject(presignRequest).url().toString();
        } catch (RuntimeException e) {
            log.error("Could not generate presigned S3 URL for {}", cleanKey, e);
            throw new StorageUnavailableException("Could not generate an upload URL");
        }
    }

    @Override
    public String getPublicCdnUrl(String objectKey) {
        String cleanKey = clean(objectKey);
        if (cdnDomain.isEmpty()) {
            return "/api/v1/storage/assets/" + cleanKey;
        }
        return cdnDomain + "/" + cleanKey;
    }

    @Override
    public void storeAsset(String objectKey, byte[] data, String contentType) {
        String cleanKey = clean(objectKey);
        if (s3Client != null) {
            try {
                PutObjectRequest.Builder request = PutObjectRequest.builder()
                        .bucket(defaultBucketName)
                        .key(cleanKey);
                if (contentType != null && !contentType.isBlank()) {
                    request.contentType(contentType);
                }
                s3Client.putObject(request.build(), RequestBody.fromBytes(data));
                return;
            } catch (RuntimeException e) {
                log.error("Could not upload asset {} to bucket {}", cleanKey, defaultBucketName, e);
                throw new StorageUnavailableException("The file could not be stored, please retry");
            }
        }

        Path target = localPath(cleanKey);
        try {
            if (target.getParent() != null) {
                Files.createDirectories(target.getParent());
            }
            Files.write(target, data);
        } catch (IOException e) {
            log.error("Could not write asset {} to {}", cleanKey, target, e);
            throw new StorageUnavailableException("The file could not be stored, please retry");
        }
    }

    @Override
    public Optional<byte[]> loadAsset(String objectKey) {
        String cleanKey = clean(objectKey);
        if (s3Client != null) {
            try {
                return Optional.of(s3Client.getObjectAsBytes(GetObjectRequest.builder()
                        .bucket(defaultBucketName)
                        .key(cleanKey)
                        .build()).asByteArray());
            } catch (NoSuchKeyException e) {
                return Optional.empty();
            } catch (RuntimeException e) {
                log.warn("Could not retrieve asset {} from bucket {}: {}", cleanKey, defaultBucketName, e.getMessage());
                return Optional.empty();
            }
        }

        Path target;
        try {
            target = localPath(cleanKey);
        } catch (IllegalArgumentException e) {
            return Optional.empty();
        }
        try {
            return Files.isRegularFile(target) ? Optional.of(Files.readAllBytes(target)) : Optional.empty();
        } catch (IOException e) {
            log.warn("Could not read asset {} from disk: {}", cleanKey, e.getMessage());
            return Optional.empty();
        }
    }

    @Override
    public String getContentType(String objectKey) {
        String lower = clean(objectKey).toLowerCase(Locale.ROOT);
        if (lower.endsWith(".png")) return "image/png";
        if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
        if (lower.endsWith(".webp")) return "image/webp";
        if (lower.endsWith(".gif")) return "image/gif";
        if (lower.endsWith(".avif")) return "image/avif";
        if (lower.endsWith(".zip") || lower.endsWith(".cbz")) return "application/zip";
        return "application/octet-stream";
    }

    private static String clean(String objectKey) {
        return objectKey.startsWith("/") ? objectKey.substring(1) : objectKey;
    }

    /// @throws IllegalArgumentException if the key would escape the storage directory
    private Path localPath(String cleanKey) {
        Path target = localStorageDir.resolve(cleanKey).normalize();
        if (!target.startsWith(localStorageDir)) {
            throw new IllegalArgumentException("Storage key escapes the storage directory: " + cleanKey);
        }
        return target;
    }
}
