package com.readora.application.port.out;

import com.readora.domain.common.UserId;
import com.readora.domain.work.ChapterId;
import com.readora.domain.work.ChapterNumber;
import com.readora.domain.work.WorkId;
import org.jspecify.annotations.Nullable;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Set;

/// Read-model queries for the "Latest updates" feed and the popularity ranking (US-08).
public interface DiscoveryQueryPort {

    record ChapterRelease(ChapterId chapterId, WorkId workId, ChapterNumber chapterNumber, String chapterTitle, Instant publishedAt) {
    }

    /// Published chapters, newest first. With `onlyFor`, only series in that reader's library or translated by teams
    /// the reader follows.
    List<ChapterRelease> findLatestReleases(@Nullable UserId onlyFor, int page, int size);

    /// The chapters among `chapterIds` the reader has finished.
    Set<ChapterId> findFinished(UserId userId, Collection<ChapterId> chapterIds);

    record PopularWork(WorkId workId, long score) {
    }

    /// Series by activity since `since`: reads + 3 × comments + 5 × library adds. Series without activity are left out.
    List<PopularWork> findPopular(Instant since, int limit);
}
