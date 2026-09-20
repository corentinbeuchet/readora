package com.readora.web.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.jspecify.annotations.Nullable;

public record CreateTeamRequest(
        @NotBlank(message = "A team needs a name") @Size(max = 255, message = "Team name cannot exceed 255 characters") String name,
        @Nullable @Size(max = 1000, message = "Team description cannot exceed 1000 characters") String description
) {
}
