package com.readora.infrastructure.storage;

import com.readora.application.port.out.StoragePort.StorageUnavailableException;
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
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class S3StorageAdapterTest {

    @TempDir
    Path tempDir;

    private S3Client s3Client;
    private S3Presigner s3Presigner;

    @BeforeEach
    void setUp() {
        s3Client = mock(S3Client.class);
        s3Presigner = mock(S3Presigner.class);
    }

    private S3StorageAdapter s3Mode(String cdn) {
        return new S3StorageAdapter(s3Client, s3Presigner, "readora-media-dev", cdn, tempDir.toString());
    }

    private S3StorageAdapter localMode(String cdn) {
        return new S3StorageAdapter(null, null, "readora-media-dev", cdn, tempDir.toString());
    }

    @Test
    @DisplayName("S3 mode: storeAsset uploads to the configured bucket and writes nothing to local disk")
    void s3ModeStoresOnlyInS3() throws Exception {
        s3Mode("https://cdn.readora.com").storeAsset("covers/test.png", "image data".getBytes(), "image/png");

        ArgumentCaptor<PutObjectRequest> captor = ArgumentCaptor.forClass(PutObjectRequest.class);
        verify(s3Client).putObject(captor.capture(), any(RequestBody.class));
        assertThat(captor.getValue().bucket()).isEqualTo("readora-media-dev");
        assertThat(captor.getValue().key()).isEqualTo("covers/test.png");
        assertThat(captor.getValue().contentType()).isEqualTo("image/png");
        try (var files = Files.walk(tempDir)) {
            assertThat(files.filter(Files::isRegularFile)).isEmpty();
        }
    }

    @Test
    @DisplayName("S3 mode: a failed upload throws StorageUnavailableException instead of pretending to succeed")
    void s3ModeFailureIsReported() {
        doThrow(S3Exception.builder().message("MinIO connection refused").build())
                .when(s3Client).putObject(any(PutObjectRequest.class), any(RequestBody.class));

        assertThatThrownBy(() -> s3Mode("").storeAsset("chapters/c1/p1.webp", "x".getBytes(), "image/webp"))
                .isInstanceOf(StorageUnavailableException.class)
                .hasMessageNotContaining("MinIO");
    }

    @Test
    @DisplayName("S3 mode: loadAsset reads from S3 and returns empty for a missing key")
    void s3ModeLoads() {
        byte[] data = "s3 remote content".getBytes();
        when(s3Client.getObjectAsBytes(any(GetObjectRequest.class)))
                .thenReturn(ResponseBytes.fromByteArray(GetObjectResponse.builder().build(), data))
                .thenThrow(NoSuchKeyException.builder().message("missing").build());
        S3StorageAdapter adapter = s3Mode("https://cdn.readora.com");

        assertThat(adapter.loadAsset("remote/cover.jpg")).contains(data);
        assertThat(adapter.loadAsset("remote/missing.jpg")).isEmpty();
        assertThat(adapter.getContentType("remote/cover.jpg")).isEqualTo("image/jpeg");
    }

    @Test
    @DisplayName("Local mode: store then load round-trips through disk; unknown keys are empty")
    void localModeRoundTrip() {
        S3StorageAdapter adapter = localMode("");
        byte[] payload = "local data".getBytes();

        adapter.storeAsset("chapters/c1/p1.webp", payload, "image/webp");

        assertThat(adapter.loadAsset("chapters/c1/p1.webp")).contains(payload);
        assertThat(adapter.loadAsset("nonexistent.png")).isEmpty();
        assertThat(adapter.getContentType("chapters/c1/p1.webp")).isEqualTo("image/webp");
    }

    @Test
    @DisplayName("Local mode: keys that escape the storage directory are never read")
    void localModeRejectsTraversal() {
        assertThat(localMode("").loadAsset("../../etc/passwd")).isEmpty();
    }

    @Test
    @DisplayName("Presigned URL uses the configured bucket and the requested validity")
    void presignedUrlWithPresigner() throws Exception {
        PresignedPutObjectRequest presigned = mock(PresignedPutObjectRequest.class);
        when(presigned.url()).thenReturn(URI.create("http://localhost:9000/readora-media-dev/upload-key?sig=123").toURL());
        when(s3Presigner.presignPutObject(any(PutObjectPresignRequest.class))).thenReturn(presigned);

        String url = s3Mode("").generatePresignedUploadUrl("scans/p1.png", Duration.ofMinutes(15));

        assertThat(url).contains("http://localhost:9000/readora-media-dev/upload-key");
        ArgumentCaptor<PutObjectPresignRequest> captor = ArgumentCaptor.forClass(PutObjectPresignRequest.class);
        verify(s3Presigner).presignPutObject(captor.capture());
        assertThat(captor.getValue().putObjectRequest().bucket()).isEqualTo("readora-media-dev");
        assertThat(captor.getValue().signatureDuration()).isEqualTo(Duration.ofMinutes(15));
    }

    @Test
    @DisplayName("Without S3 there is no presigned upload: no fake URL is returned")
    void presignWithoutS3IsUnavailable() {
        assertThatThrownBy(() -> localMode("").generatePresignedUploadUrl("scans/p1.png", Duration.ofMinutes(15)))
                .isInstanceOf(StorageUnavailableException.class);
    }

    @Test
    @DisplayName("getPublicCdnUrl formats MinIO, CloudFront and local endpoints")
    void getPublicCdnUrlFormatting() {
        assertThat(localMode("http://localhost:9000/readora-media-dev").getPublicCdnUrl("covers/manga.webp"))
                .isEqualTo("http://localhost:9000/readora-media-dev/covers/manga.webp");
        assertThat(localMode("https://cdn.readora.com/").getPublicCdnUrl("covers/manga.webp"))
                .isEqualTo("https://cdn.readora.com/covers/manga.webp");
        assertThat(localMode("").getPublicCdnUrl("covers/manga.webp"))
                .isEqualTo("/api/v1/storage/assets/covers/manga.webp");
    }
}
