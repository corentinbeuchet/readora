package com.readora.application.port.in;

import org.jspecify.annotations.Nullable;

import java.util.Optional;

/// Upload and serve media assets. Storage keys are always built by the server.
public interface ManageAssetsUseCase {

    /// @throws com.readora.domain.common.DomainValidationException for an empty file, an unsupported type or an
    ///         invalid folder
    StoredAsset upload(String folder, @Nullable String originalFilename, @Nullable String contentType, byte[] data);

    Optional<AssetContent> load(String storageKey);

    /// A time-limited direct-upload URL for a new server-generated key in `folder`.
    PresignedUpload presignUpload(String folder, String filename);

    record StoredAsset(String storageKey, String publicUrl) {}

    record AssetContent(byte[] data, String contentType) {}

    record PresignedUpload(String uploadUrl, String publicUrl, String storageKey) {}
}
