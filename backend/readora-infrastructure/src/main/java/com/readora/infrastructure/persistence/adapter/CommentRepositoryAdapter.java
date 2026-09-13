package com.readora.infrastructure.persistence.adapter;

import com.readora.application.port.out.CommentRepositoryPort;
import com.readora.domain.social.ChapterComment;
import com.readora.domain.social.CommentContent;
import com.readora.domain.social.CommentId;
import com.readora.domain.work.ChapterId;
import com.readora.domain.work.UserId;
import com.readora.infrastructure.persistence.entity.ChapterCommentJpaEntity;
import com.readora.infrastructure.persistence.repository.SpringDataCommentRepository;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Optional;

@Component
public class CommentRepositoryAdapter implements CommentRepositoryPort {

    private final SpringDataCommentRepository springDataRepository;

    public CommentRepositoryAdapter(SpringDataCommentRepository springDataRepository) {
        this.springDataRepository = springDataRepository;
    }

    @Override
    public Optional<ChapterComment> findById(CommentId id) {
        return springDataRepository.findById(id.value()).map(this::toDomain);
    }

    @Override
    public List<ChapterComment> findByChapterId(ChapterId chapterId) {
        return springDataRepository.findByChapterIdOrderByCreatedAtAsc(chapterId.value()).stream()
                .map(this::toDomain)
                .toList();
    }

    @Override
    public ChapterComment save(ChapterComment comment) {
        ChapterCommentJpaEntity entity = toEntity(comment);
        ChapterCommentJpaEntity saved = springDataRepository.save(entity);
        return toDomain(saved);
    }

    private ChapterComment toDomain(ChapterCommentJpaEntity entity) {
        return new ChapterComment(
                CommentId.of(entity.getId()),
                ChapterId.of(entity.getChapterId()),
                UserId.of(entity.getAuthorId()),
                entity.getAuthorUsername(),
                CommentContent.of(entity.getContent()),
                entity.getPageReference(),
                entity.getParentId() != null ? CommentId.of(entity.getParentId()) : null,
                entity.getDepth(),
                entity.isSpoiler(),
                entity.getUpvotes(),
                entity.getCreatedAt()
        );
    }

    private ChapterCommentJpaEntity toEntity(ChapterComment comment) {
        return new ChapterCommentJpaEntity(
                comment.getId().value(),
                comment.getChapterId().value(),
                comment.getAuthorId().value(),
                comment.getAuthorUsername(),
                comment.getContent().value(),
                comment.getPageReference(),
                comment.getParentId() != null ? comment.getParentId().value() : null,
                comment.getDepth(),
                comment.isSpoiler(),
                comment.getUpvotes(),
                comment.getCreatedAt()
        );
    }
}
