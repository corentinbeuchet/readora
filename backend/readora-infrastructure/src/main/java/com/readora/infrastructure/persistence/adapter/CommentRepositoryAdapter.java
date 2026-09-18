package com.readora.infrastructure.persistence.adapter;

import com.readora.application.port.out.CommentRepositoryPort;
import com.readora.domain.social.ChapterComment;
import com.readora.domain.social.CommentContent;
import com.readora.domain.social.CommentId;
import com.readora.domain.work.ChapterId;
import com.readora.domain.common.UserId;
import com.readora.infrastructure.persistence.entity.ChapterCommentJpaEntity;
import com.readora.infrastructure.persistence.entity.CommentUpvoteJpaEntity;
import com.readora.infrastructure.persistence.repository.SpringDataCommentRepository;
import com.readora.infrastructure.persistence.repository.SpringDataCommentUpvoteRepository;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Component
public class CommentRepositoryAdapter implements CommentRepositoryPort {

    private final SpringDataCommentRepository springDataRepository;
    private final SpringDataCommentUpvoteRepository upvoteRepository;

    public CommentRepositoryAdapter(SpringDataCommentRepository springDataRepository,
                                    SpringDataCommentUpvoteRepository upvoteRepository) {
        this.springDataRepository = springDataRepository;
        this.upvoteRepository = upvoteRepository;
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

    @Override
    @Transactional
    public UpvoteResult addUpvote(CommentId commentId, UserId voterId) {
        var key = new CommentUpvoteJpaEntity.Key(commentId.value(), voterId.value());
        boolean counted = false;
        if (!upvoteRepository.existsById(key)) {
            // A concurrent duplicate trips the (comment_id, user_id) primary key instead of double counting.
            upvoteRepository.saveAndFlush(new CommentUpvoteJpaEntity(commentId.value(), voterId.value(), Instant.now()));
            springDataRepository.incrementUpvotes(commentId.value());
            counted = true;
        }
        return new UpvoteResult(counted, springDataRepository.findUpvotesById(commentId.value()));
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
