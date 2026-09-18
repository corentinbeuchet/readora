package com.readora.domain.social;

import com.readora.domain.common.AggregateRoot;
import com.readora.domain.common.DomainValidationException;
import com.readora.domain.work.ChapterId;
import com.readora.domain.work.UserId;

import java.time.Instant;
import java.util.Objects;

public class ChapterComment extends AggregateRoot<CommentId> {
    public static final int MAX_NESTING_DEPTH = 5;

    private final ChapterId chapterId;
    private final UserId authorId;
    private final String authorUsername;
    private CommentContent content;
    private final Integer pageReference;
    private final CommentId parentId;
    private final int depth;
    private boolean isSpoiler;
    private int upvotes;
    private final Instant createdAt;

    public ChapterComment(CommentId id, ChapterId chapterId, UserId authorId, String authorUsername, CommentContent content, Integer pageReference, CommentId parentId, int depth, boolean isSpoiler, int upvotes, Instant createdAt) {
        super(id);
        this.chapterId = Objects.requireNonNull(chapterId, "ChapterId cannot be null");
        this.authorId = Objects.requireNonNull(authorId, "AuthorId cannot be null");
        this.authorUsername = authorUsername != null ? authorUsername : "Anonymous";
        this.content = Objects.requireNonNull(content, "CommentContent cannot be null");
        this.pageReference = pageReference;
        this.parentId = parentId;
        if (depth > MAX_NESTING_DEPTH) {
            throw new DomainValidationException("Comment thread nesting exceeds maximum limit of " + MAX_NESTING_DEPTH);
        }
        this.depth = depth;
        this.isSpoiler = isSpoiler;
        this.upvotes = Math.max(0, upvotes);
        this.createdAt = createdAt != null ? createdAt : Instant.now();
    }

    public static ChapterComment createRoot(ChapterId chapterId, UserId authorId, String username, String text, Integer pageReference, boolean isSpoiler) {
        CommentId id = CommentId.generate();
        ChapterComment comment = new ChapterComment(id, chapterId, authorId, username, CommentContent.of(text), pageReference, null, 1, isSpoiler, 0, Instant.now());
        comment.registerEvent(CommentPostedEvent.now(id, chapterId, authorId));
        return comment;
    }

    public static ChapterComment createReply(ChapterComment parent, UserId authorId, String username, String text, boolean isSpoiler) {
        CommentId id = CommentId.generate();
        ChapterComment reply = new ChapterComment(id, parent.getChapterId(), authorId, username, CommentContent.of(text), parent.getPageReference(), parent.getId(), parent.getDepth() + 1, isSpoiler, 0, Instant.now());
        reply.registerEvent(CommentPostedEvent.now(id, parent.getChapterId(), authorId));
        return reply;
    }

    /// Upvotes are counted by the repository (one per user, incremented atomically), so the domain only
    /// enforces who may vote.
    ///
    /// @throws DomainValidationException if the voter is the comment's author
    public void ensureCanBeUpvotedBy(UserId voterId) {
        if (this.authorId.equals(voterId)) {
            throw new DomainValidationException("You can't upvote your own comment");
        }
    }

    public ChapterId getChapterId() {
        return chapterId;
    }

    public UserId getAuthorId() {
        return authorId;
    }

    public String getAuthorUsername() {
        return authorUsername;
    }

    public CommentContent getContent() {
        return content;
    }

    public Integer getPageReference() {
        return pageReference;
    }

    public CommentId getParentId() {
        return parentId;
    }

    public int getDepth() {
        return depth;
    }

    public boolean isSpoiler() {
        return isSpoiler;
    }

    public int getUpvotes() {
        return upvotes;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
