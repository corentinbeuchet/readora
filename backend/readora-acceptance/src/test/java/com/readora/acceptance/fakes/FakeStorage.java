package com.readora.acceptance.fakes;

import com.readora.application.port.out.StoragePort;
import org.jspecify.annotations.Nullable;

import java.time.Duration;
import java.util.Optional;

/// Storage that only knows how to build CDN URLs (enough for the reader use cases).
public class FakeStorage implements StoragePort {

    @Override
    public String generatePresignedUploadUrl(String objectKey, Duration validity) {
        return "https://s3.test/" + objectKey + "?signature=fake";
    }

    @Override
    public String getPublicCdnUrl(String objectKey) {
        return "https://cdn.readora.com/" + objectKey;
    }

    @Override
    public void storeAsset(String objectKey, byte[] data, @Nullable String contentType) {
        throw new UnsupportedOperationException("not used by the reader scenarios");
    }

    @Override
    public Optional<byte[]> loadAsset(String objectKey) {
        return Optional.empty();
    }

    @Override
    public String getContentType(String objectKey) {
        return "image/webp";
    }
}
