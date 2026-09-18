package com.readora.domain.library;

import com.readora.domain.common.UserId;
import com.readora.domain.work.ChapterId;
import com.readora.domain.work.ChapterNumber;
import com.readora.domain.work.WorkId;

import java.time.Instant;
import java.util.Objects;

/// A reader opened (and maybe finished) a chapter. One per reader and chapter; `readAt` is the last visit.
///
/// @param chapterNumber copied from the chapter (numbers never change) so history needs no chapter lookup
/// @param finished whether the reader reached the last page at least once
public record ChapterRead(UserId userId, WorkId workId, ChapterId chapterId, ChapterNumber chapterNumber,
                          Instant readAt, boolean finished) {

    public ChapterRead {
        Objects.requireNonNull(userId, "UserId cannot be null");
        Objects.requireNonNull(workId, "WorkId cannot be null");
        Objects.requireNonNull(chapterId, "ChapterId cannot be null");
        Objects.requireNonNull(chapterNumber, "ChapterNumber cannot be null");
        Objects.requireNonNull(readAt, "readAt cannot be null");
    }

    /// A new visit: moves `readAt` forward; a finished chapter stays finished when re-opened.
    public ChapterRead revisit(Instant at, boolean finishedNow) {
        Instant latest = at.isAfter(readAt) ? at : readAt;
        return new ChapterRead(userId, workId, chapterId, chapterNumber, latest, finished || finishedNow);
    }
}
