package com.readora.acceptance.fakes;

import com.readora.application.port.out.ChapterRepositoryPort;
import com.readora.domain.work.Chapter;
import com.readora.domain.work.ChapterId;
import com.readora.domain.work.WorkId;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

public class InMemoryChapterRepository implements ChapterRepositoryPort {

    private final Map<ChapterId, Chapter> chapters = new ConcurrentHashMap<>();

    public List<Chapter> all() {
        return List.copyOf(chapters.values());
    }

    @Override
    public Optional<Chapter> findById(ChapterId id) {
        return Optional.ofNullable(chapters.get(id));
    }

    @Override
    public List<Chapter> findByWorkId(WorkId workId) {
        return chapters.values().stream().filter(c -> c.getWorkId().equals(workId)).toList();
    }

    @Override
    public Chapter save(Chapter chapter) {
        chapters.put(chapter.getId(), chapter);
        return chapter;
    }
}
