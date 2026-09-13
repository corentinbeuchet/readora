package com.readora.web.dto;

import com.readora.domain.work.Work;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record WorkDto(
        UUID id,
        String title,
        String synopsis,
        String type,
        String status,
        String coverImageUrl,
        List<String> genres,
        Instant createdAt,
        Instant updatedAt
) {
    public static WorkDto fromDomain(Work work) {
        return new WorkDto(
                work.getId().value(),
                work.getTitle(),
                work.getSynopsis(),
                work.getType().name(),
                work.getStatus().name(),
                work.getCoverImageUrl(),
                work.getGenres().stream().sorted().toList(),
                work.getCreatedAt(),
                work.getUpdatedAt()
        );
    }
}
