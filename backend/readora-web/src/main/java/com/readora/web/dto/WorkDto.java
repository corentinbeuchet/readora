package com.readora.web.dto;

import com.readora.application.port.in.ManageAssetsUseCase;
import com.readora.domain.work.Work;
import org.jspecify.annotations.Nullable;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public record WorkDto(
        UUID id,
        String title,
        String synopsis,
        String type,
        String status,
        @Nullable String author,
        @Nullable String demographic,
        @Nullable String coverImageUrl,
        /// The cover resized for cards and lists; `null` for a cover hosted elsewhere (use `coverImageUrl`).
        @Nullable String coverThumbnailUrl,
        List<String> genres,
        WorkFactsDto facts,
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
                work.getAuthor(),
                Optional.ofNullable(work.getDemographic()).map(Enum::name).orElse(null),
                work.getCoverImageUrl(),
                ManageAssetsUseCase.coverThumbnailOf(work.getCoverImageUrl()),
                work.getGenres().stream().sorted().toList(),
                WorkFactsDto.fromDomain(work.getFacts()),
                work.getCreatedAt(),
                work.getUpdatedAt()
        );
    }
}
