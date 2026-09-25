package com.readora.application.service;

import com.readora.application.port.in.ManageWorkUseCase.WorkDescription;
import com.readora.application.port.out.ChapterRepositoryPort;
import com.readora.application.port.out.EventPublisherPort;
import com.readora.application.port.out.ScanlationProjectRepositoryPort;
import com.readora.application.port.out.TeamRepositoryPort;
import com.readora.application.port.out.UserAccountRepositoryPort;
import com.readora.application.port.out.WorkRepositoryPort;
import com.readora.domain.common.AccessDeniedDomainException;
import com.readora.domain.common.DomainValidationException;
import com.readora.domain.common.NotFoundException;
import com.readora.domain.common.UserId;
import com.readora.domain.identity.Permission;
import com.readora.domain.identity.UserAccount;
import com.readora.domain.scanlation.ScanlationProject;
import com.readora.domain.scanlation.ScanlationRole;
import com.readora.domain.scanlation.Team;
import com.readora.domain.scanlation.TeamMember;
import com.readora.domain.work.ContentRating;
import com.readora.domain.work.OriginalLanguage;
import com.readora.domain.work.Work;
import com.readora.domain.work.WorkFacts;
import com.readora.domain.work.WorkId;
import com.readora.domain.work.WorkStatus;
import com.readora.domain.work.WorkType;
import org.jspecify.annotations.Nullable;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Answers.CALLS_REAL_METHODS;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.withSettings;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/// US-04: who may edit the description of a series, and what an edit changes.
class WorkDescriptionEditTest {

    private static final Instant NOW = Instant.parse("2026-09-20T10:00:00Z");
    private static final UserId MINA = UserId.of("mina");
    private static final UserId TOM = UserId.of("tom");
    private static final UserId AOI = UserId.of("aoi");
    private static final UserId ADMIN = UserId.of("admin");
    private static final WorkFacts SOLO_LEVELING_FACTS =
            new WorkFacts(List.of("Na Honjaman Level Up"), "DUBU", 2018, OriginalLanguage.KOREAN, ContentRating.TEEN);

    private WorkRepositoryPort workRepository;
    private ScanlationProjectRepositoryPort projectRepository;
    private TeamRepositoryPort teamRepository;
    private UserAccountRepositoryPort userRepository;
    private WorkManagementService service;

    private Work series;
    private final List<ScanlationProject> boardsOfTheSeries = new ArrayList<>();
    private final List<Team> teamsOfTheSeries = new ArrayList<>();
    private @Nullable Work edited;
    private @Nullable RuntimeException refusal;

    @BeforeEach
    void setUp() {
        workRepository = mock(WorkRepositoryPort.class);
        // Its light reads (existsByTeamAndWork, findTeamIdsByWork) derive from the stubbed full reads.
        projectRepository = mock(ScanlationProjectRepositoryPort.class, withSettings().defaultAnswer(CALLS_REAL_METHODS));
        teamRepository = mock(TeamRepositoryPort.class);
        userRepository = mock(UserAccountRepositoryPort.class);
        service = new WorkManagementService(workRepository, mock(ChapterRepositoryPort.class), projectRepository, teamRepository, userRepository,
                mock(EventPublisherPort.class), Clock.fixed(NOW, ZoneOffset.UTC));
        when(workRepository.save(any(Work.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(userRepository.findById(any(UserId.class))).thenReturn(Optional.empty());
    }

    @Test
    @DisplayName("A leader of a team that translates the series replaces its description, facts included")
    void aLeaderOfATeamOfTheSeriesEditsIt() {
        givenTheSeries("Solo Leveling");
        givenATeamTranslatingTheSeries("Shadow Scans", MINA);

        whenTheSeriesIsDescribedBy(MINA, descriptionWith("Solo Leveling", SOLO_LEVELING_FACTS));

        thenTheSeriesIsSavedWith(SOLO_LEVELING_FACTS);
        thenTheSeriesWasUpdatedAt(NOW);
    }

    @Test
    @DisplayName("A leader of any of the teams of the series may edit it, not only of the first one")
    void aLeaderOfTheSecondTeamEditsIt() {
        givenTheSeries("Solo Leveling");
        givenATeamTranslatingTheSeries("Shadow Scans", MINA);
        givenATeamTranslatingTheSeries("Moon Scans", TOM);

        whenTheSeriesIsDescribedBy(TOM, descriptionWith("Solo Leveling", SOLO_LEVELING_FACTS));

        thenTheSeriesIsSavedWith(SOLO_LEVELING_FACTS);
    }

    @Test
    @DisplayName("A leader of a team that does not translate the series cannot edit it")
    void aLeaderOfAnotherTeamIsRefused() {
        givenTheSeries("Solo Leveling");
        givenATeamTranslatingTheSeries("Shadow Scans", MINA);

        whenTheSeriesIsDescribedBy(TOM, descriptionWith("Hijacked", WorkFacts.none()));

        thenTheEditIsRefusedWith(AccessDeniedDomainException.class);
        thenNothingIsSaved();
    }

    @Test
    @DisplayName("A member of the team who is not a leader cannot edit the series")
    void aTeamMemberWhoIsNotALeaderIsRefused() {
        givenTheSeries("Solo Leveling");
        Team team = givenATeamTranslatingTheSeries("Shadow Scans", MINA);
        team.addMember(TeamMember.of(AOI, ScanlationRole.TRANSLATOR));

        whenTheSeriesIsDescribedBy(AOI, descriptionWith("Hijacked", WorkFacts.none()));

        thenTheEditIsRefusedWith(AccessDeniedDomainException.class);
        thenNothingIsSaved();
    }

    @Test
    @DisplayName("An admin edits a series without being on any of its teams")
    void anAdminEditsAnySeries() {
        givenTheSeries("Solo Leveling");
        givenATeamTranslatingTheSeries("Shadow Scans", MINA);
        givenAnAdmin(ADMIN);

        whenTheSeriesIsDescribedBy(ADMIN, descriptionWith("Solo Leveling", SOLO_LEVELING_FACTS));

        thenTheSeriesIsSavedWith(SOLO_LEVELING_FACTS);
    }

    @Test
    @DisplayName("A refused description leaves the series as it was")
    void anInvalidDescriptionChangesNothing() {
        givenTheSeries("Solo Leveling");
        givenATeamTranslatingTheSeries("Shadow Scans", MINA);

        whenTheSeriesIsDescribedBy(MINA, descriptionWith("  ", SOLO_LEVELING_FACTS));

        thenTheEditIsRefusedWith(DomainValidationException.class);
        thenTheSeriesIsStillTitled("Solo Leveling");
        thenNothingIsSaved();
    }

    @Test
    @DisplayName("Editing a series that does not exist is a not-found, whoever asks")
    void anUnknownSeriesIsNotFound() {
        WorkId unknown = givenNoSeriesWithTheId(WorkId.generate());

        whenTheSeriesIsDescribedBy(unknown, MINA, descriptionWith("Anything", WorkFacts.none()));

        thenTheEditIsRefusedWith(NotFoundException.class);
    }

    private void givenTheSeries(String title) {
        series = Work.create(title, "A hunter levels up.", WorkType.MANHWA, WorkStatus.COMPLETED, "Chugong", null, null, Set.of("Action"));
        when(workRepository.findById(series.getId())).thenReturn(Optional.of(series));
        when(projectRepository.findByWorkId(series.getId())).thenReturn(boardsOfTheSeries);
    }

    private WorkId givenNoSeriesWithTheId(WorkId id) {
        when(workRepository.findById(id)).thenReturn(Optional.empty());
        return id;
    }

    private Team givenATeamTranslatingTheSeries(String name, UserId leader) {
        Team team = Team.create(name, null, leader);
        teamsOfTheSeries.add(team);
        when(teamRepository.findAllById(any())).thenReturn(List.copyOf(teamsOfTheSeries));
        boardsOfTheSeries.add(ScanlationProject.create(name + " - " + series.getTitle(), series.getId(), team.getId()));
        return team;
    }

    private void givenAnAdmin(UserId adminId) {
        UserAccount admin = mock(UserAccount.class);
        when(admin.can(Permission.USER_MANAGE)).thenReturn(true);
        when(userRepository.findById(adminId)).thenReturn(Optional.of(admin));
    }

    private void whenTheSeriesIsDescribedBy(UserId editor, WorkDescription description) {
        whenTheSeriesIsDescribedBy(series.getId(), editor, description);
    }

    private void whenTheSeriesIsDescribedBy(WorkId workId, UserId editor, WorkDescription description) {
        try {
            edited = service.updateWork(workId, description, editor);
        } catch (RuntimeException e) {
            refusal = e;
        }
    }

    private void thenTheSeriesIsSavedWith(WorkFacts facts) {
        assertThat(refusal).isNull();
        assertThat(edited).isNotNull();
        assertThat(edited.getFacts()).isEqualTo(facts);
        verify(workRepository).save(series);
    }

    private void thenTheSeriesWasUpdatedAt(Instant instant) {
        assertThat(series.getUpdatedAt()).isEqualTo(instant);
    }

    private void thenTheEditIsRefusedWith(Class<? extends RuntimeException> type) {
        assertThat(refusal).isInstanceOf(type);
    }

    private void thenTheSeriesIsStillTitled(String title) {
        assertThat(series.getTitle()).isEqualTo(title);
    }

    private void thenNothingIsSaved() {
        verify(workRepository, never()).save(any());
    }

    private static WorkDescription descriptionWith(String title, WorkFacts facts) {
        return new WorkDescription(title, "A hunter levels up.", WorkType.MANHWA, WorkStatus.COMPLETED, "Chugong", null, null, Set.of("Action"), facts);
    }
}
