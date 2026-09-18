package com.readora.web.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.util.UUID;

public record CreateCommentRequest(
        @NotBlank(message = "Comment content cannot be blank")
        @Size(max = 2000, message = "Comment content must not exceed 2000 characters")
        String content,

        @Positive(message = "Page reference must be at least 1")
        Integer pageReference,
        UUID parentId,
        boolean isSpoiler
) {
}
