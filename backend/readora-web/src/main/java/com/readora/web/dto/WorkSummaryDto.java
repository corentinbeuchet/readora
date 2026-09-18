package com.readora.web.dto;

import com.readora.domain.work.Work;
import org.jspecify.annotations.Nullable;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public record WorkSummaryDto(
        UUID id,
        String title,
        String type,
        String status,
        @Nullable String author,
        @Nullable String demographic,
        @Nullable String coverImageUrl,
        List<String> genres
) {
    public static WorkSummaryDto fromDomain(Work work) {
        return new WorkSummaryDto(
                work.getId().value(),
                work.getTitle(),
                work.getType().name(),
                work.getStatus().name(),
                work.getAuthor(),
                Optional.ofNullable(work.getDemographic()).map(Enum::name).orElse(null),
                work.getCoverImageUrl(),
                work.getGenres().stream().sorted().toList()
        );
    }
}
