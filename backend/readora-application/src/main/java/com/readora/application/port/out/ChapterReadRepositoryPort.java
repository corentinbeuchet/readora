package com.readora.application.port.out;

import com.readora.domain.common.UserId;
import com.readora.domain.library.ChapterRead;
import com.readora.domain.work.ChapterId;
import com.readora.domain.work.WorkId;

import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Optional;

public interface ChapterReadRepositoryPort {
    Optional<ChapterRead> find(UserId userId, ChapterId chapterId);

    ChapterRead save(ChapterRead read);

    List<ChapterRead> findByUserAndWork(UserId userId, WorkId workId);

    /// The most recent read of each series, newest first, at most `limit` series.
    List<ChapterRead> findLatestPerWork(UserId userId, int limit);

    /// For each series the reader has read, how many chapter numbers are new since their last read of it: numbers
    /// whose first version came out after that read and that the reader has not finished in any version. Another
    /// team's version of an older number is not new. Series never read, or with nothing new, are absent from the map.
    Map<WorkId, Long> countChaptersPublishedSinceLastRead(UserId userId, Collection<WorkId> workIds);
}
