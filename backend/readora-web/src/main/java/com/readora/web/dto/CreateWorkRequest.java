package com.readora.web.dto;

import com.readora.domain.work.WorkStatus;
import com.readora.domain.work.WorkType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.Set;

public record CreateWorkRequest(
        @NotBlank(message = "Title is required")
        @Size(max = 255, message = "Title must not exceed 255 characters")
        String title,

        String synopsis,

        @NotNull(message = "Work type is required")
        WorkType type,

        WorkStatus status,

        String coverImageUrl,

        Set<String> genres
) {}
