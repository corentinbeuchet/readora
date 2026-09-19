package com.readora.application.service;

import com.readora.application.port.in.ModerateCommentsUseCase;
import com.readora.application.port.out.CommentReportRepositoryPort;
import com.readora.application.port.out.CommentRepositoryPort;
import com.readora.application.port.out.UserAccountRepositoryPort;
import com.readora.domain.common.AccessDeniedDomainException;
import com.readora.domain.common.DomainValidationException;
import com.readora.domain.common.NotFoundException;
import com.readora.domain.common.UserId;
import com.readora.domain.identity.Permission;
import com.readora.domain.moderation.CommentReport;
import com.readora.domain.moderation.CommentReportReason;
import com.readora.domain.moderation.CommentReportStatus;
import com.readora.domain.social.ChapterComment;
import com.readora.domain.social.CommentId;

import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

public class ModerationService implements ModerateCommentsUseCase {

    private final CommentReportRepositoryPort reports;
    private final CommentRepositoryPort comments;
    private final UserAccountRepositoryPort users;
    private final Clock clock;

    public ModerationService(CommentReportRepositoryPort reports, CommentRepositoryPort comments, UserAccountRepositoryPort users, Clock clock) {
        this.reports = Objects.requireNonNull(reports, "CommentReportRepositoryPort cannot be null");
        this.comments = Objects.requireNonNull(comments, "CommentRepositoryPort cannot be null");
        this.users = Objects.requireNonNull(users, "UserAccountRepositoryPort cannot be null");
        this.clock = Objects.requireNonNull(clock, "Clock cannot be null");
    }

    @Override
    public CommentReport report(UserId reporterId, CommentId commentId, CommentReportReason reason) {
        ChapterComment comment = visibleComment(commentId);
        if (comment.getAuthorId().equals(reporterId)) {
            throw new DomainValidationException("You cannot report your own comment");
        }
        return reports.findOpen(reporterId, commentId)
                .orElseGet(() -> reports.save(CommentReport.open(commentId, reporterId, reason, clock.instant())));
    }

    @Override
    public List<QueueItem> queue(UserId actorId) {
        requireModerator(actorId);
        return reports.findOpen(QUEUE_LIMIT).stream()
                .flatMap(report -> comments.findById(report.getCommentId()).map(comment -> new QueueItem(report, comment)).stream())
                .toList();
    }

    @Override
    public void hide(UserId actorId, UUID reportId) {
        requireModerator(actorId);
        CommentReport report = openReport(reportId);
        ChapterComment comment = comments.findById(report.getCommentId())
                .orElseThrow(() -> new NotFoundException("Comment", report.getCommentId()));
        Instant now = clock.instant();
        if (!comment.isHidden()) {
            comment.hide();
            comments.save(comment);
        }
        for (CommentReport open : reports.findOpenByComment(comment.getId())) {
            open.close(CommentReportStatus.HIDDEN, actorId, now);
            reports.save(open);
        }
    }

    @Override
    public void dismiss(UserId actorId, UUID reportId) {
        requireModerator(actorId);
        CommentReport report = openReport(reportId);
        report.close(CommentReportStatus.DISMISSED, actorId, clock.instant());
        reports.save(report);
    }

    private CommentReport openReport(UUID reportId) {
        return reports.findById(reportId).filter(CommentReport::isOpen)
                .orElseThrow(() -> new NotFoundException("Open comment report", reportId));
    }

    private ChapterComment visibleComment(CommentId commentId) {
        return comments.findById(commentId).filter(c -> !c.isHidden()).orElseThrow(() -> new NotFoundException("Comment", commentId));
    }

    private void requireModerator(UserId actorId) {
        boolean moderator = users.findById(actorId).map(account -> account.can(Permission.COMMENT_MODERATE)).orElse(false);
        if (!moderator) {
            throw new AccessDeniedDomainException("Only moderators can see and handle comment reports");
        }
    }
}
