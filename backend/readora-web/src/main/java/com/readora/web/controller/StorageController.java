package com.readora.web.controller;

import com.readora.application.port.out.StoragePort;
import com.readora.domain.common.DomainValidationException;
import com.readora.web.dto.ApiResponse;
import com.readora.web.dto.StorageUploadResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;
import java.util.Set;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/storage")
@Tag(name = "Storage", description = "Asset upload and storage management")
public class StorageController {

    private static final Set<String> ALLOWED_CONTENT_TYPES = Set.of(
            "image/jpeg",
            "image/jpg",
            "image/png",
            "image/webp",
            "image/gif",
            "image/avif",
            "application/zip",
            "application/x-zip-compressed",
            "application/octet-stream"
    );

    private final StoragePort storagePort;

    public StorageController(StoragePort storagePort) {
        this.storagePort = storagePort;
    }

    @PostMapping("/upload")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Upload image or archive asset")
    public ResponseEntity<ApiResponse<StorageUploadResponse>> uploadAsset(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "folder", defaultValue = "uploads") String folder
    ) {
        if (file == null || file.isEmpty()) {
            throw new DomainValidationException("Uploaded file cannot be empty");
        }

        String contentType = file.getContentType();
        if (contentType != null && !contentType.isBlank() && !ALLOWED_CONTENT_TYPES.contains(contentType.toLowerCase())) {
            throw new DomainValidationException("Unsupported file format: " + contentType);
        }

        String originalFilename = file.getOriginalFilename();
        String safeFilename = originalFilename != null ? originalFilename.replaceAll("[^a-zA-Z0-9._-]", "_") : "asset";
        String cleanFolder = folder.replaceAll("[^a-zA-Z0-9/_.-]", "_");
        String storageKey = cleanFolder + "/" + UUID.randomUUID() + "-" + safeFilename;

        try {
            storagePort.storeAsset(storageKey, file.getBytes(), contentType);
        } catch (Exception e) {
            throw new DomainValidationException("Failed to process uploaded file: " + e.getMessage());
        }

        String cdnUrl = storagePort.getPublicCdnUrl(storageKey);
        return ResponseEntity.ok(ApiResponse.ok(new StorageUploadResponse(storageKey, cdnUrl)));
    }

    @GetMapping("/assets/**")
    @Operation(summary = "Get stored asset")
    public ResponseEntity<byte[]> getAsset(HttpServletRequest request) {
        String fullPath = request.getRequestURI();
        String prefix = "/api/v1/storage/assets/";
        int idx = fullPath.indexOf(prefix);
        String objectKey = idx != -1 ? fullPath.substring(idx + prefix.length()) : "";

        return storagePort.loadAsset(objectKey)
                .map(data -> {
                    String contentType = storagePort.getContentType(objectKey);
                    return ResponseEntity.ok()
                            .header(HttpHeaders.CONTENT_TYPE, contentType)
                            .header(HttpHeaders.CACHE_CONTROL, "public, max-age=86400")
                            .body(data);
                })
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @GetMapping("/presigned-url")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Generate presigned upload URL")
    public ResponseEntity<ApiResponse<Map<String, String>>> getPresignedUrl(
            @RequestParam String objectKey,
            @RequestParam(defaultValue = "readora-assets") String bucketName,
            @RequestParam(defaultValue = "15") long durationMinutes
    ) {
        String uploadUrl = storagePort.generatePresignedUploadUrl(bucketName, objectKey, durationMinutes);
        String cdnUrl = storagePort.getPublicCdnUrl(objectKey);
        return ResponseEntity.ok(ApiResponse.ok(Map.of(
                "uploadUrl", uploadUrl,
                "cdnUrl", cdnUrl,
                "storageKey", objectKey
        )));
    }
}
