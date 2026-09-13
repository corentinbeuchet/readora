package com.readora.application.service;

import com.readora.application.port.out.ChapterRepositoryPort;
import com.readora.application.port.out.EventPublisherPort;
import com.readora.application.port.out.ScanlationProjectRepositoryPort;
import com.readora.application.port.out.WorkRepositoryPort;
import com.readora.domain.common.DomainValidationException;
import com.readora.domain.scanlation.ProjectId;
import com.readora.domain.scanlation.ScanlationProject;
import com.readora.domain.work.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class WorkManagementServiceTest {

    private WorkRepositoryPort workRepository;
    private ChapterRepositoryPort chapterRepository;
    private ScanlationProjectRepositoryPort projectRepository;
    private EventPublisherPort eventPublisher;
    private WorkManagementService service;

    @BeforeEach
    void setUp() {
        workRepository = mock(WorkRepositoryPort.class);
        chapterRepository = mock(ChapterRepositoryPort.class);
        projectRepository = mock(ScanlationProjectRepositoryPort.class);
        eventPublisher = mock(EventPublisherPort.class);
        service = new WorkManagementService(workRepository, chapterRepository, projectRepository, eventPublisher);
    }

    @Test
    @DisplayName("Successfully create a new work and auto-create a scanlation workspace project")
    void createWorkSuccess() {
        UserId creatorId = UserId.of("creator-123");
        when(workRepository.save(any(Work.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(projectRepository.save(any(ScanlationProject.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Work work = service.createWork(
                "Solo Leveling",
                "Hunter Sung Jinwoo story",
                WorkType.MANHWA,
                WorkStatus.ONGOING,
                "https://cdn.readora.com/covers/solo.webp",
                Set.of("Action", "Fantasy"),
                creatorId
        );

        assertThat(work).isNotNull();
        assertThat(work.getTitle()).isEqualTo("Solo Leveling");
        assertThat(work.getType()).isEqualTo(WorkType.MANHWA);
        assertThat(work.getGenres()).containsExactlyInAnyOrder("Action", "Fantasy");

        ArgumentCaptor<ScanlationProject> projectCaptor = ArgumentCaptor.forClass(ScanlationProject.class);
        verify(projectRepository).save(projectCaptor.capture());
        ScanlationProject project = projectCaptor.getValue();
        assertThat(project.getName()).isEqualTo("Solo Leveling Workspace");
        assertThat(project.getWorkId()).isEqualTo(work.getId());
    }

    @Test
    @DisplayName("Create work throws validation exception when title is empty")
    void createWorkInvalidTitle() {
        UserId creatorId = UserId.of("creator-123");

        assertThatThrownBy(() -> service.createWork("", "Synopsis", WorkType.MANGA, WorkStatus.ONGOING, null, Set.of(), creatorId))
                .isInstanceOf(DomainValidationException.class)
                .hasMessageContaining("Work title cannot be empty");
    }

    @Test
    @DisplayName("Directly publish a chapter with ordered pages")
    void directPublishChapterSuccess() {
        UserId publisherId = UserId.of("pub-1");
        Work work = Work.create("One Piece", "Pirates", WorkType.MANGA, "op.jpg", Set.of("Adventure"));
        when(workRepository.findById(work.getId())).thenReturn(Optional.of(work));
        when(chapterRepository.findByWorkId(work.getId())).thenReturn(List.of());
        when(chapterRepository.save(any(Chapter.class))).thenAnswer(invocation -> invocation.getArgument(0));

        List<PageAsset> pages = List.of(
                PageAsset.create(1, "c1/p1.webp", "https://cdn.readora.com/c1/p1.webp"),
                PageAsset.create(2, "c1/p2.webp", "https://cdn.readora.com/c1/p2.webp")
        );

        Chapter chapter = service.directPublishChapter(work.getId(), "1", "Romance Dawn", pages, publisherId);

        assertThat(chapter).isNotNull();
        assertThat(chapter.getChapterNumber().value()).isEqualTo("1");
        assertThat(chapter.getStatus()).isEqualTo(ChapterStatus.PUBLISHED);
        assertThat(chapter.getPages()).hasSize(2);
        verify(eventPublisher, atLeastOnce()).publish(any());
    }

    @Test
    @DisplayName("Directly publishing duplicate chapter number throws exception")
    void directPublishDuplicateChapterThrowsException() {
        UserId publisherId = UserId.of("pub-1");
        Work work = Work.create("One Piece", "Pirates", WorkType.MANGA, "op.jpg", Set.of("Adventure"));
        Chapter existing = Chapter.createDraft(work.getId(), ChapterNumber.of("1"), "Existing", null);

        when(workRepository.findById(work.getId())).thenReturn(Optional.of(work));
        when(chapterRepository.findByWorkId(work.getId())).thenReturn(List.of(existing));

        List<PageAsset> pages = List.of(PageAsset.create(1, "c1/p1.webp", "https://cdn.readora.com/c1/p1.webp"));

        assertThatThrownBy(() -> service.directPublishChapter(work.getId(), "1", "Duplicate", pages, publisherId))
                .isInstanceOf(DomainValidationException.class)
                .hasMessageContaining("already exists");
    }
}
