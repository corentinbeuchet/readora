package com.readora.web.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import com.readora.domain.work.WorkStatus;
import com.readora.domain.work.WorkType;

import java.util.Set;

public record CreateWorkRequest(
        @NotBlank(message = "Title is required")
        @Size(max = 255, message = "Title must not exceed 255 characters")
        String title,

        @Size(max = 5000, message = "Synopsis must not exceed 5000 characters")
        String synopsis,

        @NotNull(message = "Work type is required")
        WorkType type,

        WorkStatus status,

        @Size(max = 1024, message = "Cover image URL must not exceed 1024 characters")
        @Pattern(regexp = "^$|^https?://\\S+$|^/api/v1/storage/assets/\\S+$", message = "Cover image URL must be an http(s) URL or an uploaded asset path")
        String coverImageUrl,

        @Size(max = 20, message = "A work cannot have more than 20 genres")
        Set<@NotBlank(message = "Genre cannot be blank") @Size(max = 50, message = "Genre must not exceed 50 characters") String> genres
) {}
