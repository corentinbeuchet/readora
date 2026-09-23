package com.readora.application.service;

import com.readora.application.port.in.NotifyUseCase;
import com.readora.application.port.out.ChapterRepositoryPort;
import com.readora.application.port.out.CommentRepositoryPort;
import com.readora.application.port.out.LibraryRepositoryPort;
import com.readora.application.port.out.NotificationRepositoryPort;
import com.readora.application.port.out.TeamInvitationRepositoryPort;
import com.readora.application.port.out.TeamRepositoryPort;
import com.readora.application.port.out.UserAccountRepositoryPort;
import com.readora.application.port.out.WorkRepositoryPort;
import com.readora.domain.common.NotFoundException;
import com.readora.domain.common.UserId;
import com.readora.domain.identity.UserAccount;
import com.readora.domain.library.LibraryEntry;
import com.readora.domain.notification.Notification;
import com.readora.domain.notification.NotificationType;
import com.readora.domain.scanlation.Team;
import com.readora.domain.scanlation.TeamInvitation;
import com.readora.domain.scanlation.TeamInvitationId;
import com.readora.domain.social.ChapterComment;
import com.readora.domain.social.CommentId;
import com.readora.domain.work.Chapter;
import com.readora.domain.work.ChapterId;
import com.readora.domain.work.ReadingOrder;
import com.readora.domain.work.WorkId;

import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Objects;

public class NotificationService implements NotifyUseCase {

    private final NotificationRepositoryPort notifications;
    private final LibraryRepositoryPort library;
    private final ChapterRepositoryPort chapters;
    private final WorkRepositoryPort works;
    private final CommentRepositoryPort comments;
    private final TeamInvitationRepositoryPort invitations;
    private final TeamRepositoryPort teams;
    private final UserAccountRepositoryPort users;
    private final Clock clock;

    public NotificationService(NotificationRepositoryPort notifications, LibraryRepositoryPort library, ChapterRepositoryPort chapters,
                               WorkRepositoryPort works, CommentRepositoryPort comments, TeamInvitationRepositoryPort invitations,
                               TeamRepositoryPort teams, UserAccountRepositoryPort users, Clock clock) {
        this.notifications = Objects.requireNonNull(notifications, "NotificationRepositoryPort cannot be null");
        this.library = Objects.requireNonNull(library, "LibraryRepositoryPort cannot be null");
        this.chapters = Objects.requireNonNull(chapters, "ChapterRepositoryPort cannot be null");
        this.works = Objects.requireNonNull(works, "WorkRepositoryPort cannot be null");
        this.comments = Objects.requireNonNull(comments, "CommentRepositoryPort cannot be null");
        this.invitations = Objects.requireNonNull(invitations, "TeamInvitationRepositoryPort cannot be null");
        this.teams = Objects.requireNonNull(teams, "TeamRepositoryPort cannot be null");
        this.users = Objects.requireNonNull(users, "UserAccountRepositoryPort cannot be null");
        this.clock = Objects.requireNonNull(clock, "Clock cannot be null");
    }

    @Override
    public void notifyNewChapter(ChapterId chapterId) {
        Chapter chapter = chapters.findById(chapterId).filter(Chapter::isPublished).orElse(null);
        if (chapter == null) {
            return;
        }
        // Another team's version of a number that is already out is not news (US-12).
        if (!ReadingOrder.of(chapters.findPublishedRefsByWorkId(chapter.getWorkId())).isFirstVersion(chapterId)) {
            return;
        }
        String title = works.findById(chapter.getWorkId()).map(work -> work.getTitle()).orElse("A series in your library");
        String message = title + ": chapter " + chapter.getChapterNumber().value() + " is out";
        Instant now = clock.instant();
        List<Notification> batch = library.findSubscribers(chapter.getWorkId()).stream()
                .map(reader -> Notification.create(reader, NotificationType.NEW_CHAPTER, message, "/read/" + chapterId.value(), now))
                .toList();
        if (!batch.isEmpty()) {
            notifications.saveAll(batch);
        }
    }

    @Override
    public void notifyReply(CommentId replyId) {
        comments.findById(replyId).ifPresent(reply -> {
            CommentId parentId = reply.getParentId();
            if (parentId == null) {
                return;
            }
            comments.findById(parentId)
                    .filter(parent -> !parent.getAuthorId().equals(reply.getAuthorId()))
                    .ifPresent(parent -> notifications.saveAll(List.of(replyNotification(parent, reply))));
        });
    }

    @Override
    public void notifyInvitation(TeamInvitationId invitationId) {
        invitations.findById(invitationId).filter(TeamInvitation::isPending).ifPresent(invitation -> {
            String team = teams.findById(invitation.getTeamId()).map(Team::getName).orElse("A team");
            String inviter = users.findById(invitation.getInvitedBy()).map(UserAccount::getUsername).orElse("A leader");
            notifications.saveAll(List.of(Notification.create(invitation.getInviteeId(), NotificationType.TEAM_INVITATION,
                    inviter + " invited you to join " + team, "/scanlation", clock.instant())));
        });
    }

    private Notification replyNotification(ChapterComment parent, ChapterComment reply) {
        return Notification.create(parent.getAuthorId(), NotificationType.COMMENT_REPLY, reply.getAuthorUsername() + " replied to your comment",
                "/read/" + reply.getChapterId().value() + "?comment=" + reply.getId().value(), clock.instant());
    }

    @Override
    public List<Notification> recent(UserId userId) {
        return notifications.findRecent(userId, RECENT_LIMIT);
    }

    @Override
    public long unreadCount(UserId userId) {
        return notifications.countUnread(userId);
    }

    @Override
    public void markAllRead(UserId userId) {
        notifications.markAllRead(userId, clock.instant());
    }

    @Override
    public void setSeriesNotifications(UserId userId, WorkId workId, boolean enabled) {
        LibraryEntry entry = library.find(userId, workId).orElseThrow(() -> new NotFoundException("Library entry", workId));
        entry.setNotifications(enabled, clock.instant());
        library.save(entry);
    }
}
