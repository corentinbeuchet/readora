package com.readora.application.service;

import com.readora.application.port.in.BrowseCatalogUseCase.CatalogQuery;
import com.readora.application.port.in.BrowseCatalogUseCase.ProjectBoard;
import com.readora.application.port.out.ChapterRepositoryPort;
import com.readora.application.port.out.CommunityQueryPort;
import com.readora.application.port.out.ScanlationProjectRepositoryPort;
import com.readora.application.port.out.TeamRepositoryPort;
import com.readora.application.port.out.UserAccountRepositoryPort;
import com.readora.application.port.out.WorkRepositoryPort.WorkPage;
import com.readora.application.port.out.WorkRepositoryPort.WorkSearch;
import com.readora.application.port.out.WorkRepositoryPort;
import com.readora.domain.common.DomainValidationException;
import com.readora.domain.common.UserId;
import com.readora.domain.scanlation.ScanlationProject;
import com.readora.domain.scanlation.Team;
import com.readora.domain.work.ChapterNumber;
import com.readora.domain.work.WorkId;
import com.readora.domain.work.WorkType;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CatalogServiceTest {

    @Mock
    private WorkRepositoryPort workRepository;

    @Mock
    private ChapterRepositoryPort chapterRepository;

    @Mock
    private ScanlationProjectRepositoryPort projectRepository;

    @Mock
    private TeamRepositoryPort teamRepository;

    @Mock
    private UserAccountRepositoryPort userRepository;

    @Mock
    private CommunityQueryPort community;

    private CatalogService service;

    @BeforeEach
    void setUp() {
        service = new CatalogService(workRepository, chapterRepository, projectRepository, teamRepository, userRepository, community);
    }

    @Test
    @DisplayName("Search trims the text, lower-cases genres, drops blank ones and clamps paging")
    void normalisesTheQuery() {
        when(workRepository.search(any(), anyInt(), anyInt())).thenReturn(new WorkPage(List.of(), 0));

        var page = service.searchWorks(new CatalogQuery("  omni ", Set.of("Action", " "), Set.of("ROMANCE"),
                Set.of(WorkType.MANHWA), Set.of(), Set.of()), -3, 500);

        ArgumentCaptor<WorkSearch> search = ArgumentCaptor.forClass(WorkSearch.class);
        verify(workRepository).search(search.capture(), eq(0), eq(CatalogService.MAX_PAGE_SIZE));
        assertThat(search.getValue().text()).isEqualTo("omni");
        assertThat(search.getValue().includedGenres()).containsExactly("action");
        assertThat(search.getValue().excludedGenres()).containsExactly("romance");
        assertThat(page.page()).isZero();
    }

    @Test
    @DisplayName("A blank search text doesn't filter")
    void blankTextIsIgnored() {
        when(workRepository.search(any(), anyInt(), anyInt())).thenReturn(new WorkPage(List.of(), 0));

        service.searchWorks(new CatalogQuery("   ", Set.of(), Set.of(), Set.of(), Set.of(), Set.of()), 0, 20);

        ArgumentCaptor<WorkSearch> search = ArgumentCaptor.forClass(WorkSearch.class);
        verify(workRepository).search(search.capture(), eq(0), eq(20));
        assertThat(search.getValue().text()).isNull();
    }

    @Test
    @DisplayName("Over-long text and too many genres are rejected before querying")
    void rejectsOversizedQueries() {
        assertThatThrownBy(() -> service.searchWorks(new CatalogQuery("x".repeat(101), Set.of(), Set.of(), Set.of(), Set.of(), Set.of()), 0, 20))
                .isInstanceOf(DomainValidationException.class);

        Set<String> genres = IntStream.range(0, 21).mapToObj(i -> "g" + i).collect(Collectors.toSet());
        assertThatThrownBy(() -> service.searchWorks(new CatalogQuery(null, genres, Set.of(), Set.of(), Set.of(), Set.of()), 0, 20))
                .isInstanceOf(DomainValidationException.class);

        verifyNoInteractions(workRepository);
    }

    @Test
    @DisplayName("A task board names its members and whoever holds a task, in one lookup")
    void aBoardNamesItsPeople() {
        UserId leader = UserId.of("leader-1");
        UserId formerMember = UserId.of("gone-1");
        Team team = Team.create("Asura", null, leader);
        ScanlationProject project = ScanlationProject.create("Asura", WorkId.generate(), team.getId());
        project.addChapterTask(ChapterNumber.of("1")).assignTo(formerMember);
        when(projectRepository.findById(project.getId())).thenReturn(Optional.of(project));
        when(teamRepository.findById(team.getId())).thenReturn(Optional.of(team));
        when(community.usernames(Set.of(leader, formerMember))).thenReturn(Map.of(leader, "mina", formerMember, "old-hand"));

        ProjectBoard board = service.getProject(project.getId(), leader).orElseThrow();

        assertThat(board.usernameOf(leader)).isEqualTo("mina");
        assertThat(board.usernameOf(formerMember)).isEqualTo("old-hand");
        verify(community).usernames(any());
    }
}
