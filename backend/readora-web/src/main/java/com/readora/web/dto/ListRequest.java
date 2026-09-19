package com.readora.web.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.jspecify.annotations.Nullable;

import java.util.List;
import java.util.UUID;

public record ListRequest(
        @NotBlank(message = "A list needs a title")
        @Size(max = 100, message = "A list title must not exceed 100 characters")
        String title,

        @Size(max = 500, message = "A list description must not exceed 500 characters")
        @Nullable String description,

        boolean published,

        @Size(max = 100, message = "A list holds at most 100 series")
        @Nullable List<@Valid Item> items
) {
    public record Item(
            @NotNull(message = "Each item needs a series") UUID workId,
            @Size(max = 300, message = "A note must not exceed 300 characters") @Nullable String note
    ) {
    }
}
