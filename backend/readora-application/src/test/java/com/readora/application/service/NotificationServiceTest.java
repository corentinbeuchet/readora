package com.readora.application.service;

import com.readora.application.port.out.ChapterRepositoryPort;
import com.readora.application.port.out.CommentRepositoryPort;
import com.readora.application.port.out.LibraryRepositoryPort;
import com.readora.application.port.out.NotificationRepositoryPort;
import com.readora.application.port.out.ScanlationProjectRepositoryPort;
import com.readora.application.port.out.TeamInvitationRepositoryPort;
import com.readora.application.port.out.TeamRepositoryPort;
import com.readora.application.port.out.UserAccountRepositoryPort;
import com.readora.application.port.out.WorkRepositoryPort;
import com.readora.domain.common.UserId;
import com.readora.domain.scanlation.ScanlationProject;
import com.readora.domain.scanlation.ScanlationRole;
import com.readora.domain.scanlation.Team;
import com.readora.domain.scanlation.TeamMember;
import com.readora.domain.scanlation.WorkflowStage;
import com.readora.domain.scanlation.WorkflowTask;
import com.readora.domain.work.ChapterNumber;
import com.readora.domain.work.WorkId;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Clock;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class NotificationServiceTest {

    @Mock
    private NotificationRepositoryPort notifications;
    @Mock
    private LibraryRepositoryPort library;
    @Mock
    private ChapterRepositoryPort chapters;
    @Mock
    private WorkRepositoryPort works;
    @Mock
    private CommentRepositoryPort comments;
    @Mock
    private TeamInvitationRepositoryPort invitations;
    @Mock
    private TeamRepositoryPort teams;
    @Mock
    private ScanlationProjectRepositoryPort projects;
    @Mock
    private UserAccountRepositoryPort users;

    private NotificationService service;

    @BeforeEach
    void setUp() {
        service = new NotificationService(notifications, library, chapters, works, comments, invitations, teams, projects, users,
                Clock.systemUTC());
    }

    @Test
    @DisplayName("Nobody is told about a stage the task has already left (the notice would be stale)")
    void aTaskThatMovedOnIsNotAnnounced() {
        Team team = Team.create("Asura", null, UserId.of("leader-1"));
        team.addMember(TeamMember.of(UserId.of("translator-1"), ScanlationRole.TRANSLATOR));
        ScanlationProject project = ScanlationProject.create("Asura", WorkId.generate(), team.getId());
        WorkflowTask task = project.addChapterTask(ChapterNumber.of("1"));
        task.advanceStage(WorkflowStage.TYPESETTING);
        when(projects.findById(project.getId())).thenReturn(Optional.of(project));
        when(teams.findById(team.getId())).thenReturn(Optional.of(team));

        service.notifyTaskReady(project.getId(), task.getId(), WorkflowStage.TRANSLATING, UserId.of("leader-1"));

        verify(notifications, never()).saveAll(any());
    }
}
