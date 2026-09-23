package com.readora.web.controller;

import com.readora.web.ReadoraApplication;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;


import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.endsWith;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(classes = ReadoraApplication.class)
@AutoConfigureMockMvc
@ActiveProfiles("test")
class StorageControllerIntegrationTest extends AuthTestSupport {

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
                .andExpect(jsonPath("$.data.liteCdnUrl").doesNotExist())
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
    @DisplayName("An uploaded page also gets a public 720 px JPEG copy for the data saver")
    void uploadedPageGetsALiteCopy() throws Exception {
        Session session = registerScanlator();
        java.awt.image.BufferedImage image = new java.awt.image.BufferedImage(1440, 2000, java.awt.image.BufferedImage.TYPE_INT_RGB);
        java.util.Random random = new java.util.Random(7);
        for (int y = 0; y < image.getHeight(); y++) {
            for (int x = 0; x < image.getWidth(); x++) {
                image.setRGB(x, y, random.nextInt(0xFFFFFF));
            }
        }
        java.io.ByteArrayOutputStream png = new java.io.ByteArrayOutputStream();
        javax.imageio.ImageIO.write(image, "png", png);

        var result = mockMvc.perform(multipart("/api/v1/storage/upload")
                        .file(new MockMultipartFile("file", "p1.png", "image/png", png.toByteArray()))
                        .param("folder", "scans/lite")
                        .header("Authorization", session.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.liteCdnUrl", endsWith(".lite.jpg")))
                .andReturn();

        String storageKey = json(result).path("data").path("storageKey").asString();
        byte[] lite = mockMvc.perform(get("/api/v1/storage/assets/" + storageKey + ".lite.jpg"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsByteArray();
        assertThat(lite.length).isLessThan(png.size());
        assertThat(javax.imageio.ImageIO.read(new java.io.ByteArrayInputStream(lite)).getWidth()).isEqualTo(720);
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
