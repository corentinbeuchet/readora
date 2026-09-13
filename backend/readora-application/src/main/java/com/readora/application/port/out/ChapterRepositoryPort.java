package com.readora.application.port.out;

import com.readora.domain.work.Chapter;
import com.readora.domain.work.ChapterId;
import com.readora.domain.work.WorkId;

import java.util.List;
import java.util.Optional;

public interface ChapterRepositoryPort {
    Optional<Chapter> findById(ChapterId id);
    List<Chapter> findByWorkId(WorkId workId);
    Chapter save(Chapter chapter);
}
