package com.readora.application.port.out;

import com.readora.domain.work.Chapter;
import com.readora.domain.work.ChapterId;
import com.readora.domain.work.ChapterNumber;
import com.readora.domain.work.WorkId;

import java.util.List;
import java.util.Optional;

public interface ChapterRepositoryPort {
    Optional<Chapter> findById(ChapterId id);
    List<Chapter> findByWorkId(WorkId workId);
    Chapter save(Chapter chapter);

    default Optional<Chapter> findByWorkIdAndChapterNumber(WorkId workId, ChapterNumber chapterNumber) {
        return findByWorkId(workId).stream().filter(c -> c.getChapterNumber().equals(chapterNumber)).findFirst();
    }

    /// Published chapters of a work in reading order (numeric chapter order).
    default List<Chapter> findPublishedByWorkId(WorkId workId) {
        return findByWorkId(workId).stream().filter(Chapter::isPublished).sorted(java.util.Comparator.comparing(Chapter::getChapterNumber)).toList();
    }
}
