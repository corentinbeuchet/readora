package com.readora.application.service;

import com.readora.application.port.in.ReaderInteractionUseCase;
import com.readora.application.port.out.ChapterRepositoryPort;
import com.readora.application.port.out.CommentRepositoryPort;
import com.readora.application.port.out.EventPublisherPort;
import com.readora.domain.common.DomainValidationException;
import com.readora.domain.common.NotFoundException;
import com.readora.domain.social.ChapterComment;
import com.readora.domain.social.CommentId;
import com.readora.domain.work.Chapter;
import com.readora.domain.work.ChapterId;
import com.readora.domain.work.UserId;

import java.util.List;
import java.util.Objects;

public class ReaderSocialService implements ReaderInteractionUseCase {
    private final CommentRepositoryPort commentRepository;
    private final ChapterRepositoryPort chapterRepository;
    private final EventPublisherPort eventPublisher;

    public ReaderSocialService(CommentRepositoryPort commentRepository, ChapterRepositoryPort chapterRepository, EventPublisherPort eventPublisher) {
        this.commentRepository = Objects.requireNonNull(commentRepository, "CommentRepositoryPort cannot be null");
        this.chapterRepository = Objects.requireNonNull(chapterRepository, "ChapterRepositoryPort cannot be null");
        this.eventPublisher = Objects.requireNonNull(eventPublisher, "EventPublisherPort cannot be null");
    }

    @Override
    public ChapterComment postRootComment(ChapterId chapterId, UserId authorId, String username, String text, Integer pageRef, boolean isSpoiler) {
        requirePublishedChapter(chapterId);
        ChapterComment comment = ChapterComment.createRoot(chapterId, authorId, username, text, pageRef, isSpoiler);
        ChapterComment saved = commentRepository.save(comment);
        comment.pollDomainEvents().forEach(eventPublisher::publish);
        return saved;
    }

    @Override
    public ChapterComment replyToComment(CommentId parentCommentId, UserId authorId, String username, String text, boolean isSpoiler) {
        ChapterComment parent = commentRepository.findById(parentCommentId)
                .orElseThrow(() -> new NotFoundException("Parent comment", parentCommentId));

        ChapterComment reply = ChapterComment.createReply(parent, authorId, username, text, isSpoiler);
        ChapterComment saved = commentRepository.save(reply);
        reply.pollDomainEvents().forEach(eventPublisher::publish);
        return saved;
    }

    @Override
    public UpvoteOutcome upvoteComment(CommentId commentId, UserId voterId) {
        ChapterComment comment = commentRepository.findById(commentId)
                .orElseThrow(() -> new NotFoundException("Comment", commentId));
        comment.ensureCanBeUpvotedBy(voterId);
        CommentRepositoryPort.UpvoteResult result = commentRepository.addUpvote(commentId, voterId);
        return new UpvoteOutcome(commentId, result.upvotes(), result.counted());
    }

    @Override
    public List<ChapterComment> getCommentsForChapter(ChapterId chapterId) {
        return commentRepository.findByChapterId(chapterId);
    }

    /// Comments are only allowed on chapters readers can see.
    ///
    /// @throws NotFoundException if the chapter does not exist
    /// @throws DomainValidationException if it is still a draft
    private void requirePublishedChapter(ChapterId chapterId) {
        Chapter chapter = chapterRepository.findById(chapterId)
                .orElseThrow(() -> new NotFoundException("Chapter", chapterId));
        if (!chapter.isPublished()) {
            throw new DomainValidationException("Comments are only allowed on published chapters");
        }
    }
}
