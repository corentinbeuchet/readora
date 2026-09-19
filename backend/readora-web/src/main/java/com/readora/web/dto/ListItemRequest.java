package com.readora.web.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.jspecify.annotations.Nullable;

import java.util.UUID;

public record ListItemRequest(
        @NotNull(message = "A series is required") UUID workId,
        @Size(max = 300, message = "A note must not exceed 300 characters") @Nullable String note
) {
}
