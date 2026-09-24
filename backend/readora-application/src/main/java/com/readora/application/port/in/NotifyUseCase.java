package com.readora.application.port.in;

import com.readora.domain.common.UserId;
import com.readora.domain.notification.Notification;
import com.readora.domain.scanlation.ProjectId;
import com.readora.domain.scanlation.TaskId;
import com.readora.domain.scanlation.TeamInvitationId;
import com.readora.domain.scanlation.WorkflowStage;
import com.readora.domain.social.CommentId;
import com.readora.domain.work.ChapterId;
import com.readora.domain.work.WorkId;

import java.util.List;

/// In-app notifications (US-10). The `notify…` methods are called after the triggering transaction commits.
public interface NotifyUseCase {
    int RECENT_LIMIT = 30;

    /// Tells every reader who has the chapter's series in their library (notifications on).
    void notifyNewChapter(ChapterId chapterId);

    /// Tells the author of the comment that `replyId` answers (not when replying to yourself).
    void notifyReply(CommentId replyId);

    /// Tells a reader a team invited them (only while the invitation still waits for their answer).
    void notifyInvitation(TeamInvitationId invitationId);

    /// Tells the members who work on the task's stage that a chapter waits for them, except `by` (who put it
    /// there); when nobody holds that role, the team's leaders. Nothing when the task has moved on since.
    void notifyTaskReady(ProjectId projectId, TaskId taskId, WorkflowStage stage, UserId by);

    /// Tells the leaders of the chapter's team that a moderator sent it back (only while it is still a draft).
    void notifyChapterSentBack(ChapterId chapterId);

    List<Notification> recent(UserId userId);

    long unreadCount(UserId userId);

    void markAllRead(UserId userId);

    /// @throws com.readora.domain.common.NotFoundException if the series is not in the reader's library
    void setSeriesNotifications(UserId userId, WorkId workId, boolean enabled);
}
