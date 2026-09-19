package com.readora.application.port.in;

import com.readora.domain.common.UserId;
import com.readora.domain.library.ChapterRead;
import com.readora.domain.work.ChapterId;
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

    /// @param finished published chapters of the work the reader finished
    /// @param nextToRead the first published chapter after the last finished one (the first chapter if none is
    ///                   finished), or `null` when the reader is up to date
    record WorkProgress(WorkId workId, Set<ChapterId> finished, @Nullable ChapterId nextToRead) {
        public WorkProgress {
            finished = Set.copyOf(finished);
        }
    }

    /// Records a visit of a published chapter; `finished` once true stays true.
    ///
    /// @throws com.readora.domain.common.NotFoundException if the chapter doesn't exist or isn't published
    ChapterRead recordRead(UserId userId, ChapterId chapterId, boolean finished);

    /// The series the reader read most recently, newest first, with the last chapter read in each.
    List<HistoryItem> history(UserId userId, int limit);

    WorkProgress progress(UserId userId, WorkId workId);

    /// "Mark all previous as read": every published chapter before this one becomes finished, for readers who
    /// caught up elsewhere. The chapter itself is left as it is, so it becomes the next one to read.
    ///
    /// @throws com.readora.domain.common.NotFoundException if the chapter doesn't exist or isn't published
    WorkProgress markReadUpTo(UserId userId, ChapterId chapterId);
}
