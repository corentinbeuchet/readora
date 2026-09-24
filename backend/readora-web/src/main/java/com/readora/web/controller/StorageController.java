package com.readora.web.controller;

import com.readora.application.port.in.ManageAssetsUseCase;
import com.readora.domain.common.DomainValidationException;
import com.readora.web.dto.ApiResponse;
import com.readora.web.dto.StorageUploadResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;

@RestController
@RequestMapping("/api/v1/storage")
@Tag(name = "Storage", description = "Asset upload and storage management")
public class StorageController {

    private static final String ASSETS_PREFIX = "/api/v1/storage/assets/";

    /// An asset never changes under its key (`AssetService` builds `<folder>/<uuid>-<name>`, a new upload gets a new
    /// key), so browsers and CDNs keep it for a year without asking again.
    static final String ASSET_CACHING = "public, max-age=31536000, immutable";

    private final ManageAssetsUseCase assets;

    public StorageController(ManageAssetsUseCase assets) {
        this.assets = assets;
    }

    @PostMapping("/upload")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Upload image or archive asset")
    public ResponseEntity<ApiResponse<StorageUploadResponse>> uploadAsset(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "folder", defaultValue = "uploads") String folder
    ) {
        byte[] bytes;
        try {
            bytes = file.getBytes();
        } catch (IOException e) {
            throw new DomainValidationException("The uploaded file could not be read");
        }
        var stored = assets.upload(folder, file.getOriginalFilename(), file.getContentType(), bytes);
        return ResponseEntity.ok(ApiResponse.ok(new StorageUploadResponse(stored.storageKey(), stored.publicUrl(), stored.litePublicUrl())));
    }

    @GetMapping("/assets/**")
    @Operation(summary = "Get stored asset")
    public ResponseEntity<byte[]> getAsset(HttpServletRequest request) {
        String fullPath = request.getRequestURI();
        int idx = fullPath.indexOf(ASSETS_PREFIX);
        String objectKey = idx != -1 ? fullPath.substring(idx + ASSETS_PREFIX.length()) : "";

        return assets.load(objectKey)
                .map(content -> ResponseEntity.ok()
                        .header(HttpHeaders.CONTENT_TYPE, content.contentType())
                        .header(HttpHeaders.CACHE_CONTROL, ASSET_CACHING)
                        .body(content.data()))
                .orElseGet(() -> ResponseEntity.notFound().build());
    }
}
