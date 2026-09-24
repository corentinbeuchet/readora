package com.readora.application.port.in;

import org.jspecify.annotations.Nullable;

import java.util.Optional;
import java.util.regex.Pattern;

/// Upload and serve media assets. Storage keys are always built by the server.
public interface ManageAssetsUseCase {

    /// A cover's thumbnail is stored next to it under the cover's key plus this suffix.
    String COVER_THUMBNAIL_SUFFIX = ".thumb.jpg";

    /// A cover the server stored: `covers/<uuid>-<name>` from an upload, or `seed/covers/<uuid>.png` from the dev
    /// seed, at the end of its key or public URL. Anything else (a cover URL on another site) has no thumbnail.
    Pattern STORED_COVER = Pattern.compile(
            "(?:^|/)covers/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?:-[A-Za-z0-9._-]+|\\.png)$");

    /// The thumbnail URL of a cover (or key) the server stored, `null` for any other cover. Covers stored before
    /// thumbnails existed have none: the frontend falls back to the cover when the thumbnail fails to load.
    static @Nullable String coverThumbnailOf(@Nullable String cover) {
        return cover != null && STORED_COVER.matcher(cover).find() ? cover + COVER_THUMBNAIL_SUFFIX : null;
    }

    /// Stores the file; for images also a lighter copy for the reader's data saver (`<key>.lite.jpg`), when one
    /// can be made and is smaller, and for a cover (folder `covers`) its thumbnail ([#coverThumbnailOf(String)]).
    ///
    /// @throws com.readora.domain.common.DomainValidationException for an empty file, an unsupported type or an
    ///         invalid folder
    StoredAsset upload(String folder, @Nullable String originalFilename, @Nullable String contentType, byte[] data);

    Optional<AssetContent> load(String storageKey);

    /// @param litePublicUrl the data-saver copy, or `null` when none was made
    record StoredAsset(String storageKey, String publicUrl, @Nullable String litePublicUrl) {}

    record AssetContent(byte[] data, String contentType) {}
}
