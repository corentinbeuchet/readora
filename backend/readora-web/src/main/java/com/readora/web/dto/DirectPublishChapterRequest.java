package com.readora.web.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;
import java.util.UUID;

/// @param teamId the team the chapter is published for; who publishes always comes from the token
public record DirectPublishChapterRequest(
        @NotNull(message = "teamId is required")
        UUID teamId,

        @NotBlank(message = "Chapter number is required")
        @Size(max = 50, message = "Chapter number must not exceed 50 characters")
        String chapterNumber,

        @Size(max = 255, message = "Title must not exceed 255 characters")
        String title,

        @NotEmpty(message = "Pages list cannot be empty")
        @Size(max = 1000, message = "A chapter cannot have more than 1000 pages")
        List<@Valid PageAssetDto> pages
) {}
