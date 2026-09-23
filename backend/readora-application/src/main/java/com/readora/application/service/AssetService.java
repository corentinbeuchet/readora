package com.readora.application.service;

import com.readora.application.port.in.ManageAssetsUseCase;
import com.readora.application.port.out.ImageVariantPort;
import com.readora.application.port.out.StoragePort;
import com.readora.domain.common.DomainValidationException;
import com.readora.domain.common.ErrorCodes;
import org.jspecify.annotations.Nullable;

import java.util.Arrays;
import java.util.Locale;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

public class AssetService implements ManageAssetsUseCase {

    private static final Set<String> ALLOWED_CONTENT_TYPES = Set.of(
            "image/jpeg",
            "image/jpg",
            "image/png",
            "image/webp",
            "image/gif",
            "image/avif",
            "application/zip",
            "application/x-zip-compressed",
            "application/octet-stream"
    );

    /// Suffix of the data-saver copy stored next to an uploaded image (US-07).
    static final String LITE_SUFFIX = ".lite.jpg";

    private final StoragePort storagePort;
    private final ImageVariantPort imageVariants;

    public AssetService(StoragePort storagePort, ImageVariantPort imageVariants) {
        this.storagePort = Objects.requireNonNull(storagePort, "StoragePort cannot be null");
        this.imageVariants = Objects.requireNonNull(imageVariants, "ImageVariantPort cannot be null");
    }

    @Override
    public StoredAsset upload(String folder, @Nullable String originalFilename, @Nullable String contentType, byte[] data) {
        if (data == null || data.length == 0) {
            throw DomainValidationException.withCode(ErrorCodes.EMPTY_FILE, "Uploaded file cannot be empty");
        }
        if (contentType != null && !contentType.isBlank() && !ALLOWED_CONTENT_TYPES.contains(contentType.toLowerCase(Locale.ROOT))) {
            throw DomainValidationException.withCode(ErrorCodes.UNSUPPORTED_FILE_FORMAT, "Unsupported file format: " + contentType);
        }
        String storageKey = newStorageKey(folder, originalFilename);
        storagePort.storeAsset(storageKey, data, contentType);
        String liteUrl = null;
        if (isImage(contentType)) {
            Optional<byte[]> lite = imageVariants.lightVersion(data);
            if (lite.isPresent()) {
                String liteKey = storageKey + LITE_SUFFIX;
                storagePort.storeAsset(liteKey, lite.get(), "image/jpeg");
                liteUrl = storagePort.getPublicCdnUrl(liteKey);
            }
        }
        return new StoredAsset(storageKey, storagePort.getPublicCdnUrl(storageKey), liteUrl);
    }

    private static boolean isImage(@Nullable String contentType) {
        return contentType != null && contentType.toLowerCase(Locale.ROOT).startsWith("image/");
    }

    @Override
    public Optional<AssetContent> load(String storageKey) {
        return storagePort.loadAsset(storageKey).map(data -> new AssetContent(data, storagePort.getContentType(storageKey)));
    }

    /// Server-built key `<folder>/<uuid>-<filename>`: the client picks a folder and a filename but never the
    /// full key, so it cannot overwrite an existing asset or escape the folder with `..`.
    ///
    /// @throws DomainValidationException if the folder is empty or contains a `.` or `..` segment
    static String newStorageKey(@Nullable String folder, @Nullable String originalFilename) {
        String cleanFolder = folder == null ? "" : folder.trim().replaceAll("[^a-zA-Z0-9/_.-]", "_");
        cleanFolder = cleanFolder.replaceAll("/{2,}", "/").replaceAll("^/+|/+$", "");
        if (cleanFolder.isEmpty()
                || Arrays.stream(cleanFolder.split("/")).anyMatch(segment -> segment.equals("..") || segment.equals("."))) {
            throw new DomainValidationException("Invalid storage folder");
        }
        String safeFilename = originalFilename == null || originalFilename.isBlank()
                ? "asset"
                : originalFilename.replaceAll("[^a-zA-Z0-9._-]", "_");
        return cleanFolder + "/" + UUID.randomUUID() + "-" + safeFilename;
    }
}
