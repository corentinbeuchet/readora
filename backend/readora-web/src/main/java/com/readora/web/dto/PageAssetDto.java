package com.readora.web.dto;

public record PageAssetDto(
        int pageNumber,
        String storageKey,
        String cdnUrl,
        int width,
        int height
) {
}
