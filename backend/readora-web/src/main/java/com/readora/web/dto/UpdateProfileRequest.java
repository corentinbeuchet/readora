package com.readora.web.dto;

import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;


public record UpdateProfileRequest(
        @Size(min = 1, max = 100, message = "Display name must be between 1 and 100 characters")
        String displayName,

        @Size(max = 1000, message = "Bio must not exceed 1000 characters")
        String bio,

        @Size(max = 1024, message = "Avatar URL must not exceed 1024 characters")
        @Pattern(regexp = "^$|^https?://\\S+$|^/api/v1/storage/assets/\\S+$", message = "Avatar URL must be an http(s) URL or an uploaded asset path")
        String avatarUrl
) {
}
