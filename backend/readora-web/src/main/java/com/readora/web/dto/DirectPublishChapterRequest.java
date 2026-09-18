package com.readora.web.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

import java.util.List;

public record DirectPublishChapterRequest(
        @NotBlank(message = "Chapter number is required")
        @Size(max = 50, message = "Chapter number must not exceed 50 characters")
        String chapterNumber,

        @Size(max = 255, message = "Title must not exceed 255 characters")
        String title,

        @NotEmpty(message = "Pages list cannot be empty")
        @Size(max = 1000, message = "A chapter cannot have more than 1000 pages")
        @Valid
        List<PageAssetDto> pages
) {}
