package com.readora.application.port.in;

import com.readora.domain.common.UserId;
import com.readora.domain.library.ChapterRead;
import com.readora.domain.work.ChapterId;
import com.readora.domain.work.ChapterNumber;
import com.readora.domain.work.Work;
import com.readora.domain.work.WorkId;
import org.jspecify.annotations.Nullable;

import java.util.List;
import java.util.Set;

/// Reading history and read markers (US-07): free for every signed-in reader.
public interface TrackReadingUseCase {
    int MAX_HISTORY = 50;

    record HistoryItem(Work work, ChapterRead lastRead) {
    }

    /// Progress follows the chapter number: a number is read once the reader finished any team's version of it.
    ///
    /// @param finished        the published versions the reader finished (what history and "continue" point at)
    /// @param finishedNumbers the chapter numbers read, in any version
    /// @param nextNumber      the first number after the last one read (the first number if none is read), or `null`
    ///                        when the reader is up to date
    /// @param nextToRead      the version of `nextNumber` to open: by the team the reader read last in this series
    ///                        when it has one, otherwise the first one published
    record WorkProgress(WorkId workId, Set<ChapterId> finished, Set<ChapterNumber> finishedNumbers, @Nullable ChapterNumber nextNumber,
                        @Nullable ChapterId nextToRead) {
        public WorkProgress {
            finished = Set.copyOf(finished);
            finishedNumbers = Set.copyOf(finishedNumbers);
        }
    }

    /// Records a visit of a published chapter; `finished` once true stays true.
    ///
    /// @throws com.readora.domain.common.NotFoundException if the chapter doesn't exist or isn't published
    ChapterRead recordRead(UserId userId, ChapterId chapterId, boolean finished);

    /// The series the reader read most recently, newest first, with the last chapter read in each.
    @ReadOnly
    List<HistoryItem> history(UserId userId, int limit);

    @ReadOnly
    WorkProgress progress(UserId userId, WorkId workId);

    /// "Mark all previous as read": every chapter number before this one becomes finished (one version each, by the
    /// same team when it has one), for readers who caught up elsewhere. The chapter itself is left as it is, so it becomes the next one to read.
    ///
    /// @throws com.readora.domain.common.NotFoundException if the chapter doesn't exist or isn't published
    WorkProgress markReadUpTo(UserId userId, ChapterId chapterId);
}
