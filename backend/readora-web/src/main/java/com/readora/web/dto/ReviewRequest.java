package com.readora.web.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.jspecify.annotations.Nullable;

public record ReviewRequest(
        @Min(value = 1, message = "A rating is between 1 and 10")
        @Max(value = 10, message = "A rating is between 1 and 10")
        int score,

        @Size(max = 2000, message = "What you liked must not exceed 2000 characters")
        @Nullable String liked,

        @Size(max = 2000, message = "What you didn't like must not exceed 2000 characters")
        @Nullable String disliked,

        @NotBlank(message = "A review needs a verdict")
        @Size(max = 2000, message = "The verdict must not exceed 2000 characters")
        String verdict
) {
}
