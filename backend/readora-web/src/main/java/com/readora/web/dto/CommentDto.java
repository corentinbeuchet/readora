package com.readora.web.dto;

import com.readora.domain.social.ChapterComment;
import org.jspecify.annotations.Nullable;
import java.time.Instant;
import java.util.UUID;

public record CommentDto(
        UUID id,
        UUID chapterId,
        String authorId,
        String authorUsername,
        String content,
        @Nullable Integer pageReference,
        @Nullable UUID parentId,
        int depth,
        boolean isSpoiler,
        int upvotes,
        Instant createdAt
) {
    public static CommentDto fromDomain(ChapterComment comment) {
        return new CommentDto(
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
