package com.readora.application.port.out;

import java.util.Optional;

/// Makes lighter copies of uploaded images: for the reader's data saver (US-07) and cover thumbnails.
public interface ImageVariantPort {

    /// A smaller, lower-quality JPEG copy of `image`.
    ///
    /// @return empty when the bytes are not a readable image, the image is too large to decode safely, or the copy
    ///         would not be smaller than the original; never throws for bad input
    Optional<byte[]> lightVersion(byte[] image);

    /// A JPEG copy of a cover, small enough for every place a cover is shown (cards, lists, the series page).
    ///
    /// @return empty only when the bytes are not a readable image or the image is too large to decode safely;
    ///         never throws for bad input
    Optional<byte[]> coverThumbnail(byte[] image);
}
