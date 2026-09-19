package com.readora.application.port.out;

import com.readora.domain.common.UserId;
import com.readora.domain.moderation.CommentReport;
import com.readora.domain.social.CommentId;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface CommentReportRepositoryPort {
    Optional<CommentReport> findById(UUID id);

    CommentReport save(CommentReport report);

    Optional<CommentReport> findOpen(UserId reporterId, CommentId commentId);

    List<CommentReport> findOpenByComment(CommentId commentId);

    /// Open reports, oldest first.
    List<CommentReport> findOpen(int limit);
}
