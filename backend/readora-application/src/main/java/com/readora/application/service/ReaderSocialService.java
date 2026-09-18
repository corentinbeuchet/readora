package com.readora.application.service;

import com.readora.application.port.in.ReaderInteractionUseCase;
import com.readora.application.port.out.BookmarkRepositoryPort;
import com.readora.application.port.out.CommentRepositoryPort;
import com.readora.application.port.out.EventPublisherPort;
import com.readora.domain.common.NotFoundException;
import com.readora.domain.social.Bookmark;
import com.readora.domain.social.ChapterComment;
import com.readora.domain.social.CommentId;
import com.readora.domain.social.ReadingProgressUpdatedEvent;
import com.readora.domain.work.ChapterId;
import com.readora.domain.work.UserId;
import com.readora.domain.work.WorkId;

import java.util.List;
import java.util.Objects;

public class ReaderSocialService implements ReaderInteractionUseCase {
    private final CommentRepositoryPort commentRepository;
    private final BookmarkRepositoryPort bookmarkRepository;
    private final EventPublisherPort eventPublisher;

    public ReaderSocialService(CommentRepositoryPort commentRepository, BookmarkRepositoryPort bookmarkRepository, EventPublisherPort eventPublisher) {
        this.commentRepository = Objects.requireNonNull(commentRepository, "CommentRepositoryPort cannot be null");
        this.bookmarkRepository = Objects.requireNonNull(bookmarkRepository, "BookmarkRepositoryPort cannot be null");
        this.eventPublisher = Objects.requireNonNull(eventPublisher, "EventPublisherPort cannot be null");
    }

    @Override
    public ChapterComment postRootComment(ChapterId chapterId, UserId authorId, String username, String text, Integer pageRef, boolean isSpoiler) {
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

    @Override
    public Bookmark updateReadingProgress(UserId userId, WorkId workId, ChapterId chapterId, int pageIndex) {
        Bookmark bookmark = bookmarkRepository.findByUserIdAndWorkId(userId, workId)
                .orElseGet(() -> Bookmark.startReading(userId, workId, chapterId, pageIndex));

        bookmark.updateProgress(chapterId, pageIndex);
        Bookmark saved = bookmarkRepository.save(bookmark);

        eventPublisher.publish(ReadingProgressUpdatedEvent.now(userId, workId, chapterId, pageIndex));
        return saved;
    }
}
