package com.readora.acceptance.fakes;

import com.readora.application.port.out.StoragePort;
import org.jspecify.annotations.Nullable;

import java.time.Duration;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/// In-memory storage with fake CDN URLs.
public class FakeStorage implements StoragePort {

    private final Map<String, byte[]> objects = new ConcurrentHashMap<>();

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
        objects.put(objectKey, data.clone());
    }

    @Override
    public Optional<byte[]> loadAsset(String objectKey) {
        return Optional.ofNullable(objects.get(objectKey)).map(byte[]::clone);
    }

    /// The object behind a URL built by [#getPublicCdnUrl(String)].
    public Optional<byte[]> loadByUrl(String url) {
        return loadAsset(url.replace("https://cdn.readora.com/", ""));
    }

    @Override
    public String getContentType(String objectKey) {
        return objectKey.endsWith(".jpg") ? "image/jpeg" : "image/webp";
    }
}
