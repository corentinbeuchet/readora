package com.readora.web.dto;

import com.readora.domain.work.Work;

import java.util.List;
import java.util.UUID;

public record WorkSummaryDto(
        UUID id,
        String title,
        String type,
        String status,
        String coverImageUrl,
        List<String> genres
) {
    public static WorkSummaryDto fromDomain(Work work) {
        return new WorkSummaryDto(
                work.getId().value(),
                work.getTitle(),
                work.getType().name(),
                work.getStatus().name(),
                work.getCoverImageUrl(),
                work.getGenres().stream().sorted().toList()
        );
    }
}
