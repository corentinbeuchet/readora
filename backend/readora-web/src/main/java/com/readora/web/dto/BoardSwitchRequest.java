package com.readora.web.dto;

import jakarta.validation.constraints.NotNull;

/// Whether the team uses the task board for this series.
public record BoardSwitchRequest(@NotNull(message = "Say whether the task board is on") Boolean enabled) {
}
