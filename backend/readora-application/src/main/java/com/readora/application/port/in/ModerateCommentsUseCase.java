package com.readora.application.port.in;

import com.readora.domain.common.UserId;
import com.readora.domain.moderation.CommentReport;
import com.readora.domain.moderation.CommentReportReason;
import com.readora.domain.social.ChapterComment;
import com.readora.domain.social.CommentId;

import java.util.List;
import java.util.UUID;

/// Comment reports and the moderation queue (US-11).
public interface ModerateCommentsUseCase {
    int QUEUE_LIMIT = 100;

    record QueueItem(CommentReport report, ChapterComment comment) {
    }

    /// Reporting a comment you already reported (and still open) returns that report.
    ///
    /// @throws com.readora.domain.common.NotFoundException if the comment doesn't exist or is hidden
    /// @throws com.readora.domain.common.DomainValidationException for your own comment
    CommentReport report(UserId reporterId, CommentId commentId, CommentReportReason reason);

    /// @throws com.readora.domain.common.AccessDeniedDomainException unless the actor can moderate
    @ReadOnly
    List<QueueItem> queue(UserId actorId);

    /// Hides the comment and closes every open report on it.
    ///
    /// @throws com.readora.domain.common.AccessDeniedDomainException unless the actor can moderate
    void hide(UserId actorId, UUID reportId);

    /// @throws com.readora.domain.common.AccessDeniedDomainException unless the actor can moderate
    void dismiss(UserId actorId, UUID reportId);
}
