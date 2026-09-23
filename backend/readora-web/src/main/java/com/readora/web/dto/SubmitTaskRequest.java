package com.readora.web.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

import java.util.List;

/// The pages a stage produced (images already uploaded through `POST /storage/upload`); they replace the task's pages.
public record SubmitTaskRequest(
        @NotEmpty(message = "Upload at least one page")
        @Size(max = 500, message = "A chapter cannot have more than 500 pages")
        List<@Valid PageAssetDto> pages
) {
}
