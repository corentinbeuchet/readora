package com.readora.web.controller;

import com.readora.web.ReadoraApplication;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.PresignedPutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.model.PutObjectPresignRequest;

import java.net.URI;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.endsWith;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.startsWith;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(classes = ReadoraApplication.class)
@AutoConfigureMockMvc
@ActiveProfiles("test")
class StorageControllerIntegrationTest extends AuthTestSupport {

    /// Tests run with local-disk storage (`aws.s3.enabled=false`); only presigning needs a (fake) S3 presigner.
    @MockitoBean
    private S3Presigner s3Presigner;

    @BeforeEach
    void fakePresigner() {
        when(s3Presigner.presignPutObject(any(PutObjectPresignRequest.class))).thenAnswer(invocation -> {
            PutObjectPresignRequest request = invocation.getArgument(0);
            PresignedPutObjectRequest presigned = mock(PresignedPutObjectRequest.class);
            when(presigned.url()).thenReturn(URI.create("https://s3.test/" + request.putObjectRequest().bucket() + "/"
                    + request.putObjectRequest().key() + "?X-Amz-Expires=" + request.signatureDuration().toSeconds()).toURL());
            return presigned;
        });
    }

    @Test
    @DisplayName("Authenticated user can upload an image asset")
    void uploadImageAssetSuccess() throws Exception {
        Session session = registerScanlator();

        MockMultipartFile file = new MockMultipartFile(
                "file",
                "cover.png",
                "image/png",
                "dummy image content".getBytes()
        );

        var result = mockMvc.perform(multipart("/api/v1/storage/upload")
                        .file(file)
                        .param("folder", "covers")
                        .header("Authorization", session.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.storageKey", containsString("covers/")))
                .andExpect(jsonPath("$.data.storageKey", containsString("cover.png")))
                .andExpect(jsonPath("$.data.cdnUrl", containsString("covers/")))
                .andReturn();

        String storageKey = json(result).path("data").path("storageKey").asString();

        // Verify publicly accessible via GET /api/v1/storage/assets/** without auth header
        mockMvc.perform(get("/api/v1/storage/assets/" + storageKey))
                .andExpect(status().isOk())
                .andExpect(resultMatcher -> {
                    byte[] content = resultMatcher.getResponse().getContentAsByteArray();
                    org.assertj.core.api.Assertions.assertThat(new String(content)).isEqualTo("dummy image content");
                });
    }

    @Test
    @DisplayName("Empty file upload throws bad request / validation exception")
    void uploadEmptyFileFails() throws Exception {
        Session session = registerScanlator();

        MockMultipartFile emptyFile = new MockMultipartFile(
                "file",
                "empty.png",
                "image/png",
                new byte[0]
        );

        mockMvc.perform(multipart("/api/v1/storage/upload")
                        .file(emptyFile)
                        .header("Authorization", session.bearer()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false));
    }

    @Test
    @DisplayName("Unsupported file type (.exe) is rejected")
    void uploadUnsupportedTypeFails() throws Exception {
        Session session = registerScanlator();

        MockMultipartFile exeFile = new MockMultipartFile(
                "file",
                "virus.exe",
                "application/x-msdownload",
                "binary content".getBytes()
        );

        mockMvc.perform(multipart("/api/v1/storage/upload")
                        .file(exeFile)
                        .header("Authorization", session.bearer()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.error", containsString("Unsupported file format")));
    }

    @Test
    @DisplayName("A scanlator gets a presigned upload URL for a server-generated key in the requested folder")
    void getPresignedUrl() throws Exception {
        Session session = registerScanlator();

        var result = mockMvc.perform(get("/api/v1/storage/presigned-url")
                        .param("folder", "raw")
                        .param("filename", "test-page.jpg")
                        .header("Authorization", session.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.storageKey", startsWith("raw/")))
                .andExpect(jsonPath("$.data.storageKey", endsWith("-test-page.jpg")))
                .andReturn();

        String storageKey = json(result).path("data").path("storageKey").asString();
        assertThat(storageKey).isNotEqualTo("raw/test-page.jpg");
        assertThat(json(result).path("data").path("uploadUrl").asString()).contains(storageKey);
        assertThat(json(result).path("data").path("cdnUrl").asString()).contains(storageKey);
    }

    @Test
    @DisplayName("A plain reader cannot obtain a presigned upload URL")
    void readerCannotGetPresignedUrl() throws Exception {
        Session session = register();

        mockMvc.perform(get("/api/v1/storage/presigned-url")
                        .param("filename", "page.jpg")
                        .header("Authorization", session.bearer()))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("The presigned URL endpoint ignores a client-chosen bucket and duration")
    void presignedUrlIgnoresClientBucketAndDuration() throws Exception {
        Session session = registerScanlator();

        mockMvc.perform(get("/api/v1/storage/presigned-url")
                        .param("filename", "page.jpg")
                        .param("bucketName", "someone-elses-bucket")
                        .param("durationMinutes", "100000")
                        .header("Authorization", session.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.uploadUrl", not(containsString("someone-elses-bucket"))))
                .andExpect(jsonPath("$.data.uploadUrl", not(containsString("expires=100000"))));
    }

    @Test
    @DisplayName("Upload into a folder containing '..' is rejected")
    void uploadWithTraversalFolderFails() throws Exception {
        Session session = registerScanlator();
        MockMultipartFile file = new MockMultipartFile("file", "cover.png", "image/png", "img".getBytes());

        mockMvc.perform(multipart("/api/v1/storage/upload")
                        .file(file)
                        .param("folder", "covers/../../etc")
                        .header("Authorization", session.bearer()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false));
    }
}
