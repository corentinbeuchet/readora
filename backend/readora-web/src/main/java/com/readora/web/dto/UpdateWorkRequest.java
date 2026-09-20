package com.readora.web.dto;

import com.readora.domain.work.Demographic;
import com.readora.domain.work.WorkStatus;
import com.readora.domain.work.WorkType;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.jspecify.annotations.Nullable;

import java.util.Set;

/// The whole description of a series, as `PUT /works/{id}` replaces it: a field left out is emptied, not kept.
/// Same limits as [CreateWorkRequest]. Who edits comes from the JWT, never from the body.
public record UpdateWorkRequest(
        @NotBlank(message = "Title is required")
        @Size(max = 255, message = "Title must not exceed 255 characters")
        String title,

        @Size(max = 5000, message = "Synopsis must not exceed 5000 characters")
        @Nullable String synopsis,

        @NotNull(message = "Work type is required")
        WorkType type,

        @Nullable WorkStatus status,

        @Size(max = 120, message = "Author must not exceed 120 characters")
        @Nullable String author,

        @Nullable Demographic demographic,

        @Size(max = 1024, message = "Cover image URL must not exceed 1024 characters")
        @Pattern(regexp = "^$|^https?://\\S+$|^/api/v1/storage/assets/\\S+$", message = "Cover image URL must be an http(s) URL or an uploaded asset path")
        @Nullable String coverImageUrl,

        @Size(max = 20, message = "A work cannot have more than 20 genres")
        @Nullable Set<@NotBlank(message = "Genre cannot be blank") @Size(max = 50, message = "Genre must not exceed 50 characters") String> genres,

        @Valid @Nullable WorkFactsRequest facts
) {
}
