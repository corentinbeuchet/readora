package com.readora.application.port.out;

import com.readora.domain.social.ChapterComment;
import com.readora.domain.social.CommentId;
import com.readora.domain.work.ChapterId;

import java.util.List;
import java.util.Optional;

public interface CommentRepositoryPort {
    Optional<ChapterComment> findById(CommentId id);
    List<ChapterComment> findByChapterId(ChapterId chapterId);
    ChapterComment save(ChapterComment comment);
}
