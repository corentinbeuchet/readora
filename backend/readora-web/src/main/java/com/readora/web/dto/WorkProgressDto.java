package com.readora.web.dto;

import com.readora.application.port.in.TrackReadingUseCase.WorkProgress;
import com.readora.domain.work.ChapterId;
import org.jspecify.annotations.Nullable;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/// @param nextChapterId the chapter to read next, `null` when the reader is up to date
public record WorkProgressDto(UUID workId, List<UUID> finishedChapterIds, @Nullable UUID nextChapterId) {
    public static WorkProgressDto fromDomain(WorkProgress progress) {
        return new WorkProgressDto(
                progress.workId().value(),
                progress.finished().stream().map(ChapterId::value).sorted().toList(),
                Optional.ofNullable(progress.nextToRead()).map(ChapterId::value).orElse(null));
    }
}
