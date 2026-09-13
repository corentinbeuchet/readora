package com.readora.web.dto;

public record StorageUploadResponse(
        String storageKey,
        String cdnUrl
) {}
