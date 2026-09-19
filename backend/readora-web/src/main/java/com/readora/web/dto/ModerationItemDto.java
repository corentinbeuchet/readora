package com.readora.web.dto;

import com.readora.application.port.in.ModerateCommentsUseCase.QueueItem;

import java.time.Instant;
import java.util.UUID;

/// A report in the moderation queue, with the reported comment.
public record ModerationItemDto(UUID reportId, String reason, Instant reportedAt, UUID commentId, UUID chapterId, String authorUsername,
                                String content, boolean spoiler) {
    public static ModerationItemDto fromDomain(QueueItem item) {
        var comment = item.comment();
        return new ModerationItemDto(item.report().getId(), item.report().getReason().name(), item.report().getCreatedAt(),
                comment.getId().value(), comment.getChapterId().value(), comment.getAuthorUsername(), comment.getContent().value(),
                comment.isSpoiler());
    }
}
