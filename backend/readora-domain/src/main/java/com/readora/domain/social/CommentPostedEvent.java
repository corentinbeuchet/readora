package com.readora.domain.social;

import com.readora.domain.common.DomainEvent;
import com.readora.domain.common.UserId;
import com.readora.domain.work.ChapterId;
import org.jspecify.annotations.Nullable;

import java.time.Instant;

/// @param parentId the comment replied to, `null` for a top-level comment
public record CommentPostedEvent(
        CommentId commentId,
        ChapterId chapterId,
        UserId authorId,
        @Nullable CommentId parentId,
        Instant occurredOn
) implements DomainEvent {
    public static CommentPostedEvent now(CommentId commentId, ChapterId chapterId, UserId authorId, @Nullable CommentId parentId) {
        return new CommentPostedEvent(commentId, chapterId, authorId, parentId, Instant.now());
    }
}
