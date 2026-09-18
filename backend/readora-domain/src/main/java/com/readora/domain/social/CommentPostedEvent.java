package com.readora.domain.social;

import com.readora.domain.common.DomainEvent;
import com.readora.domain.work.ChapterId;
import com.readora.domain.common.UserId;

import java.time.Instant;

public record CommentPostedEvent(
        CommentId commentId,
        ChapterId chapterId,
        UserId authorId,
        Instant occurredOn
) implements DomainEvent {
    public static CommentPostedEvent now(CommentId commentId, ChapterId chapterId, UserId authorId) {
        return new CommentPostedEvent(commentId, chapterId, authorId, Instant.now());
    }
}
