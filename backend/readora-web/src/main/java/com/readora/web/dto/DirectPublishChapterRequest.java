package com.readora.web.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;

import java.util.List;

public record DirectPublishChapterRequest(
        @NotBlank(message = "Chapter number is required")
        String chapterNumber,

        String title,

        @NotEmpty(message = "Pages list cannot be empty")
        @Valid
        List<PageAssetDto> pages
) {}
