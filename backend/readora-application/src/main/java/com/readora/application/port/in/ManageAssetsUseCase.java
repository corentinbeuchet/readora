package com.readora.application.port.in;

import org.jspecify.annotations.Nullable;

import java.util.Optional;

/// Upload and serve media assets. Storage keys are always built by the server.
public interface ManageAssetsUseCase {

    /// Stores the file; for images also a lighter copy for the reader's data saver (`<key>.lite.jpg`), when one
    /// can be made and is smaller.
    ///
    /// @throws com.readora.domain.common.DomainValidationException for an empty file, an unsupported type or an
    ///         invalid folder
    StoredAsset upload(String folder, @Nullable String originalFilename, @Nullable String contentType, byte[] data);

    Optional<AssetContent> load(String storageKey);

    /// @param litePublicUrl the data-saver copy, or `null` when none was made
    record StoredAsset(String storageKey, String publicUrl, @Nullable String litePublicUrl) {}

    record AssetContent(byte[] data, String contentType) {}
}
