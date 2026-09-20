package com.readora.web.dto;

import jakarta.validation.constraints.NotNull;

import java.util.UUID;

public record TeamSeriesRequest(@NotNull(message = "workId is required") UUID workId) {
}
