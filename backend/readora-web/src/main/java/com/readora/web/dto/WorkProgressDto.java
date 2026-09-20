package com.readora.web.dto;

import com.readora.application.port.in.TrackReadingUseCase.WorkProgress;
import com.readora.domain.work.ChapterId;
import com.readora.domain.work.ChapterNumber;
import org.jspecify.annotations.Nullable;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/// Progress follows the chapter number: a number is read once any team's version of it is finished.
///
/// @param finishedChapterIds     the versions the reader finished
/// @param finishedChapterNumbers the chapter numbers read, in any version
/// @param nextChapterNumber      the number to read next, `null` when the reader is up to date
/// @param nextChapterId          the version of that number to open (the team read last, else the first published)
public record WorkProgressDto(UUID workId, List<UUID> finishedChapterIds, List<String> finishedChapterNumbers,
                              @Nullable String nextChapterNumber, @Nullable UUID nextChapterId) {
    public static WorkProgressDto fromDomain(WorkProgress progress) {
        return new WorkProgressDto(
                progress.workId().value(),
                progress.finished().stream().map(ChapterId::value).sorted().toList(),
                progress.finishedNumbers().stream().sorted().map(ChapterNumber::value).toList(),
                Optional.ofNullable(progress.nextNumber()).map(ChapterNumber::value).orElse(null),
                Optional.ofNullable(progress.nextToRead()).map(ChapterId::value).orElse(null));
    }
}
