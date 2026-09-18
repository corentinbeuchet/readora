package com.readora.infrastructure.storage;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.ArgumentCaptor;
import software.amazon.awssdk.core.ResponseBytes;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;
import software.amazon.awssdk.services.s3.model.NoSuchKeyException;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.model.S3Exception;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.PresignedPutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.model.PutObjectPresignRequest;

import java.net.URI;
import java.nio.file.Path;
import java.time.Duration;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class S3StorageAdapterTest {

    @TempDir
    Path tempDir;

    private S3Client mockS3Client;
    private S3Presigner mockS3Presigner;

    @BeforeEach
    void setUp() {
        mockS3Client = mock(S3Client.class);
        mockS3Presigner = mock(S3Presigner.class);
    }

    @Test
    @DisplayName("storeAsset uploads to S3Client and caches locally")
    void storeAssetSuccess() {
        S3StorageAdapter adapter = new S3StorageAdapter(
                mockS3Client,
                mockS3Presigner,
                "readora-media-dev",
                "http://localhost:9000/readora-media-dev",
                tempDir.toString()
        );

        byte[] payload = "image data".getBytes();
        adapter.storeAsset("covers/test.png", payload, "image/png");

        // Verify S3Client was invoked
        ArgumentCaptor<PutObjectRequest> requestCaptor = ArgumentCaptor.forClass(PutObjectRequest.class);
        verify(mockS3Client).putObject(requestCaptor.capture(), any(RequestBody.class));
        assertThat(requestCaptor.getValue().bucket()).isEqualTo("readora-media-dev");
        assertThat(requestCaptor.getValue().key()).isEqualTo("covers/test.png");
        assertThat(requestCaptor.getValue().contentType()).isEqualTo("image/png");

        // Verify locally loadable
        Optional<byte[]> loaded = adapter.loadAsset("covers/test.png");
        assertThat(loaded).isPresent().contains(payload);
        assertThat(adapter.getContentType("covers/test.png")).isEqualTo("image/png");
    }

    @Test
    @DisplayName("storeAsset handles S3 exception gracefully with local fallback")
    void storeAssetFallbackOnS3Error() {
        doThrow(S3Exception.builder().message("MinIO connection refused").build())
                .when(mockS3Client).putObject(any(PutObjectRequest.class), any(RequestBody.class));

        S3StorageAdapter adapter = new S3StorageAdapter(
                mockS3Client,
                mockS3Presigner,
                "readora-media-dev",
                "/api/v1/storage/assets",
                tempDir.toString()
        );

        byte[] payload = "fallback data".getBytes();
        adapter.storeAsset("chapters/c1/p1.webp", payload, "image/webp");

        Optional<byte[]> loaded = adapter.loadAsset("chapters/c1/p1.webp");
        assertThat(loaded).isPresent().contains(payload);
    }

    @Test
    @DisplayName("loadAsset fetches from S3Client when not present in memory")
    void loadAssetFromS3() {
        S3StorageAdapter adapter = new S3StorageAdapter(
                mockS3Client,
                mockS3Presigner,
                "readora-media-dev",
                "https://cdn.readora.com",
                tempDir.toString()
        );

        byte[] s3Data = "s3 remote content".getBytes();
        GetObjectResponse responseMeta = GetObjectResponse.builder()
                .contentType("image/jpeg")
                .build();
        ResponseBytes<GetObjectResponse> responseBytes = ResponseBytes.fromByteArray(responseMeta, s3Data);

        when(mockS3Client.getObjectAsBytes(any(GetObjectRequest.class))).thenReturn(responseBytes);

        Optional<byte[]> result = adapter.loadAsset("remote/cover.jpg");
        assertThat(result).isPresent().contains(s3Data);
        assertThat(adapter.getContentType("remote/cover.jpg")).isEqualTo("image/jpeg");
    }

    @Test
    @DisplayName("loadAsset returns empty when key not found in S3 or local")
    void loadAssetNotFound() {
        when(mockS3Client.getObjectAsBytes(any(GetObjectRequest.class)))
                .thenThrow(NoSuchKeyException.builder().message("Key not found").build());

        S3StorageAdapter adapter = new S3StorageAdapter(
                mockS3Client,
                mockS3Presigner,
                "readora-media-dev",
                "",
                tempDir.toString()
        );

        Optional<byte[]> result = adapter.loadAsset("nonexistent.png");
        assertThat(result).isEmpty();
    }

    @Test
    @DisplayName("generatePresignedUploadUrl uses S3Presigner when available")
    void presignedUrlWithPresigner() throws Exception {
        PresignedPutObjectRequest presignedResponse = mock(PresignedPutObjectRequest.class);
        when(presignedResponse.url()).thenReturn(URI.create("http://localhost:9000/readora-media-dev/upload-key?sig=123").toURL());
        when(mockS3Presigner.presignPutObject(any(PutObjectPresignRequest.class))).thenReturn(presignedResponse);

        S3StorageAdapter adapter = new S3StorageAdapter(
                mockS3Client,
                mockS3Presigner,
                "readora-media-dev",
                "http://localhost:9000/readora-media-dev",
                tempDir.toString()
        );

        String url = adapter.generatePresignedUploadUrl("scans/p1.png", Duration.ofMinutes(15));
        assertThat(url).contains("http://localhost:9000/readora-media-dev/upload-key");

        ArgumentCaptor<PutObjectPresignRequest> captor = ArgumentCaptor.forClass(PutObjectPresignRequest.class);
        verify(mockS3Presigner).presignPutObject(captor.capture());
        assertThat(captor.getValue().putObjectRequest().bucket()).isEqualTo("readora-media-dev");
        assertThat(captor.getValue().signatureDuration()).isEqualTo(Duration.ofMinutes(15));
    }

    @Test
    @DisplayName("getPublicCdnUrl properly formats MinIO, CloudFront, and local endpoints")
    void getPublicCdnUrlFormatting() {
        S3StorageAdapter minioAdapter = new S3StorageAdapter(
                null, null, "readora-media-dev", "http://localhost:9000/readora-media-dev", tempDir.toString()
        );
        assertThat(minioAdapter.getPublicCdnUrl("covers/manga.webp"))
                .isEqualTo("http://localhost:9000/readora-media-dev/covers/manga.webp");

        S3StorageAdapter cloudFrontAdapter = new S3StorageAdapter(
                null, null, "readora-media-prod", "https://cdn.readora.com", tempDir.toString()
        );
        assertThat(cloudFrontAdapter.getPublicCdnUrl("covers/manga.webp"))
                .isEqualTo("https://cdn.readora.com/covers/manga.webp");

        S3StorageAdapter fallbackAdapter = new S3StorageAdapter(
                null, null, "readora-media-dev", "", tempDir.toString()
        );
        assertThat(fallbackAdapter.getPublicCdnUrl("covers/manga.webp"))
                .isEqualTo("/api/v1/storage/assets/covers/manga.webp");
    }
}
