package com.readora.acceptance.steps;

import com.readora.acceptance.fakes.InMemoryChapterRepository;
import com.readora.acceptance.fakes.InMemoryCommentRepository;
import com.readora.acceptance.fakes.InMemoryLibraryRepository;
import com.readora.acceptance.fakes.InMemoryNotificationRepository;
import com.readora.acceptance.fakes.InMemoryTeamInvitationRepository;
import com.readora.acceptance.fakes.InMemoryTeamRepository;
import com.readora.acceptance.fakes.InMemoryWorkRepository;
import com.readora.acceptance.fakes.NoUserAccounts;
import com.readora.application.port.out.ChapterRepositoryPort;
import com.readora.application.port.out.EventPublisherPort;
import com.readora.application.port.out.ScanlationProjectRepositoryPort;
import com.readora.application.service.NotificationService;
import com.readora.application.service.ScanlationTaskService;
import com.readora.domain.common.DomainEvent;
import com.readora.domain.common.DomainValidationException;
import com.readora.domain.common.ErrorCodes;
import com.readora.domain.common.UserId;
import com.readora.domain.scanlation.*;
import com.readora.domain.work.*;
import com.readora.domain.work.PageAsset;
import io.cucumber.java.Before;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;

import java.time.Clock;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

import static org.assertj.core.api.Assertions.assertThat;

public class ScanlationWorkflowStepDefinitions {

    private final Map<ProjectId, ScanlationProject> projectStore = new ConcurrentHashMap<>();
    private final Map<ChapterId, Chapter> chapterStore = new ConcurrentHashMap<>();
    private final List<DomainEvent> emittedEvents = new ArrayList<>();

    private ScanlationTaskService scanlationTaskService;
    private NotificationService notifications;
    private final InMemoryWorkRepository works = new InMemoryWorkRepository();
    private final InMemoryTeamRepository teams = new InMemoryTeamRepository();
    private Team currentTeam;
    private ScanlationProject currentProject;
    private WorkflowTask currentTask;
    private Exception thrownException;

    @Before
    public void setup() {
        projectStore.clear();
        chapterStore.clear();
        emittedEvents.clear();
        thrownException = null;

        ScanlationProjectRepositoryPort projectRepo = new ScanlationProjectRepositoryPort() {
            @Override
            public Optional<ScanlationProject> findById(ProjectId id) {
                return Optional.ofNullable(projectStore.get(id));
            }

            @Override
            public List<ScanlationProject> findByWorkId(WorkId workId) {
                return projectStore.values().stream().filter(p -> p.getWorkId().equals(workId)).toList();
            }

            @Override
            public List<ScanlationProject> findByTeamId(TeamId teamId) {
                return projectStore.values().stream().filter(p -> p.getTeamId().equals(teamId)).toList();
            }

            @Override
            public ScanlationProject save(ScanlationProject project) {
                projectStore.put(project.getId(), project);
                // Like the JPA adapter: the returned object is rebuilt from state and carries no pending events.
                return new ScanlationProject(project.getId(), project.getName(), project.getWorkId(), project.getTeamId(),
                        project.getTasks(), project.isBoardEnabled(), project.getCreatedAt(), project.getUpdatedAt());
            }
        };

        ChapterRepositoryPort chapterRepo = new ChapterRepositoryPort() {
            @Override
            public Optional<Chapter> findById(ChapterId id) {
                return Optional.ofNullable(chapterStore.get(id));
            }

            @Override
            public List<Chapter> findByWorkId(WorkId workId) {
                return chapterStore.values().stream().filter(c -> c.getWorkId().equals(workId)).toList();
            }

            @Override
            public boolean hasPublishedChapter(TeamId teamId) {
                return chapterStore.values().stream().anyMatch(c -> c.getTeamId().equals(teamId) && c.isPublished());
            }

            @Override
            public List<Chapter> findWaitingForReview(int limit) {
                return chapterStore.values().stream().filter(Chapter::isWaitingForReview).limit(limit).toList();
            }

            @Override
            public Chapter save(Chapter chapter) {
                chapterStore.put(chapter.getId(), chapter);
                // Like the JPA adapter: the returned object is rebuilt from state and carries no pending events.
                return new Chapter(chapter.getId(), chapter.getWorkId(), chapter.getChapterNumber(), chapter.getTitle(),
                        chapter.getStatus(), chapter.getPages(), chapter.getTeamId(), chapter.getCreatedAt(),
                        chapter.getPublishedAt(), chapter.getUpdatedAt());
            }
        };

        InMemoryChapterRepository readerChapters = new InMemoryChapterRepository();
        notifications = new NotificationService(new InMemoryNotificationRepository(), new InMemoryLibraryRepository(), readerChapters, works,
                new InMemoryCommentRepository(), new InMemoryTeamInvitationRepository(), teams, projectRepo, new NoUserAccounts(), Clock.systemUTC());
        // As `NotificationEventListener` does after commit.
        EventPublisherPort eventPublisher = event -> {
            emittedEvents.add(event);
            if (event instanceof TaskStageAdvancedEvent reached) {
                notifications.notifyTaskReady(reached.projectId(), reached.taskId(), reached.stage(), reached.by());
            }
        };
        scanlationTaskService = new ScanlationTaskService(projectRepo, teams, chapterRepo, eventPublisher, new NoUserAccounts());
    }

    @Given("a scanlation team {string} exists")
    public void scanlationTeamExists(String teamName) {
        currentTeam = Team.create(teamName, null, UserId.of("LeaderBob"));
        teams.save(currentTeam);
    }

    @Given("{string} has a scanlation project managed by {string}")
    public void projectManagedByTeam(String workTitle, String teamName) {
        Work work = works.save(Work.create(workTitle, "", WorkType.MANHWA, "", Set.of()));
        currentProject = ScanlationProject.create(teamName + " - " + workTitle, work.getId(), currentTeam.getId());
        projectStore.put(currentProject.getId(), currentProject);
    }

    @Given("team member {string} has role {string}")
    public void teamMemberHasRole(String memberName, String roleStr) {
        ScanlationRole role = ScanlationRole.valueOf(roleStr);
        currentTeam.addMember(TeamMember.of(UserId.of(memberName), role));
        teams.save(currentTeam);
    }

    @Given("{string} has role {string} in another team {string}")
    public void memberOfAnotherTeam(String memberName, String roleStr, String teamName) {
        Team other = Team.create(teamName, null, UserId.of(teamName + " leader"));
        other.addMember(TeamMember.of(UserId.of(memberName), ScanlationRole.valueOf(roleStr)));
        teams.save(other);
    }

    @Given("{string} workflow task is in stage {string}")
    public void taskIsInStage(String chapterName, String stageStr) {
        String num = chapterName.replaceAll("[^0-9.]", "");
        currentTask = currentProject.addChapterTask(ChapterNumber.of(num.isEmpty() ? "10" : num));
        if (!stageStr.equals("RAW_UPLOADED")) {
            currentTask.advanceStage(WorkflowStage.valueOf(stageStr));
        }
    }

    @When("{string} claims the task for {string}")
    public void memberClaimsTask(String memberName, String chapterName) {
        try {
            currentTask = scanlationTaskService.claimTask(currentProject.getId(), currentTask.getId(), UserId.of(memberName));
        } catch (Exception e) {
            thrownException = e;
        }
    }

    @When("{string} uploads {int} cleaned pages")
    public void memberUploadsCleanedPages(String memberName, int pageCount) {
        try {
            currentTask = scanlationTaskService.submitWork(currentProject.getId(), currentTask.getId(), UserId.of(memberName), pages("cleaned", pageCount));
        } catch (Exception e) {
            thrownException = e;
        }
    }

    @Then("the task status becomes {string} for {string}")
    public void verifyTaskStatus(String statusStr, String stageStr) {
        assertThat(currentTask.getStatus()).isIn(TaskStatus.valueOf(statusStr), TaskStatus.PENDING);
    }

    @Then("the chapter workflow stage advances to {string}")
    public void verifyStageAdvanced(String expectedStageStr) {
        assertThat(currentTask.getStage()).isEqualTo(WorkflowStage.valueOf(expectedStageStr));
    }

    @When("{string} attempts to claim the translation task")
    public void memberAttemptsToClaimTranslation(String memberName) {
        try {
            currentTask = scanlationTaskService.claimTask(currentProject.getId(), currentTask.getId(), UserId.of(memberName));
        } catch (Exception e) {
            thrownException = e;
        }
    }

    @Then("the chapter is credited to the team {string}")
    public void theChapterIsCreditedToTheTeam(String teamName) {
        assertThat(currentTeam.getName()).isEqualTo(teamName);
        assertThat(taskChapter().getTeamId()).isEqualTo(currentTeam.getId());
    }

    @Then("the assignment is rejected because {string} is not on the team")
    public void verifyNotOnTheTeam(String memberName) {
        assertThat(thrownException)
                .isInstanceOf(DomainValidationException.class)
                .hasMessageContaining("is not a member of project");
        assertThat(currentTask.getAssigneeId()).isNull();
    }

    @Then("the assignment is rejected because {string} lacks the {string} role")
    public void verifyRoleRejection(String memberName, String roleStr) {
        assertThat(thrownException)
                .isInstanceOf(DomainValidationException.class)
                .hasMessageContaining("User lacks required role");
    }

    @Given("{string} workflow task is assigned to {string} in stage {string}")
    public void taskIsAssignedInStage(String chapterName, String memberName, String stageStr) {
        String num = chapterName.replaceAll("[^0-9.]", "");
        currentTask = currentProject.addChapterTask(ChapterNumber.of(num.isEmpty() ? "10" : num));
        currentTask.advanceStage(WorkflowStage.valueOf(stageStr));
        currentTask.assignTo(UserId.of(memberName));
    }

    @When("{string} uploads {int} translated pages")
    public void memberUploadsTranslatedPages(String memberName, int pageCount) {
        try {
            currentTask = scanlationTaskService.submitWork(currentProject.getId(), currentTask.getId(), UserId.of(memberName), pages("translated", pageCount));
        } catch (Exception e) {
            thrownException = e;
        }
    }

    @Then("the task stage advances to {string}")
    public void verifyTaskStage(String stageStr) {
        assertThat(currentTask.getStage()).isEqualTo(WorkflowStage.valueOf(stageStr));
    }

    @Given("{string} has passed proofreading and is in stage {string} with {int} pages uploaded")
    public void chapterInQcReview(String chapterName, String stageStr, int pageCount) {
        String num = chapterName.replaceAll("[^0-9.]", "");
        currentTask = currentProject.addChapterTask(ChapterNumber.of(num.isEmpty() ? "10" : num), pages("final", pageCount), UserId.of("LeaderBob"));
        currentTask.advanceStage(WorkflowStage.valueOf(stageStr));
    }

    @Given("{string} is in stage {string} with no pages uploaded")
    public void chapterWithoutPages(String chapterName, String stageStr) {
        String num = chapterName.replaceAll("[^0-9.]", "");
        currentTask = currentProject.addChapterTask(ChapterNumber.of(num));
        currentTask.advanceStage(WorkflowStage.valueOf(stageStr));
    }

    @Then("the published chapter has the {int} pages the team uploaded, in order")
    public void thePublishedChapterHasTheUploadedPages(int pageCount) {
        assertThat(taskChapter().getPages()).extracting(PageAsset::storageKey)
                .containsExactlyElementsOf(pages("final", pageCount).stream().map(PageAsset::storageKey).toList());
    }

    @Then("the publication is refused because the chapter has no pages")
    public void thePublicationIsRefusedBecauseNoPages() {
        assertThat(thrownException).isInstanceOfSatisfying(DomainValidationException.class,
                e -> assertThat(e.code()).isEqualTo(ErrorCodes.TASK_HAS_NO_PAGES));
        assertThat(chapterStore.values()).noneMatch(Chapter::isPublished);
    }

    /// Pages as the storage endpoint would have stored them: `scans/c10/<stage>/p<n>.webp`.
    private static List<PageAsset> pages(String stage, int count) {
        return java.util.stream.IntStream.rangeClosed(1, count)
                .mapToObj(n -> PageAsset.create(n, "scans/c10/" + stage + "/p" + n + ".webp", "https://cdn.readora.com/scans/c10/" + stage + "/p" + n + ".webp"))
                .toList();
    }

    @When("{string} approves the final assembled chapter and triggers publication")
    public void qcApprovesAndPublishes(String memberName) {
        try {
            scanlationTaskService.publishChapterFromQC(currentProject.getId(), currentTask.getId(), UserId.of(memberName));
        } catch (Exception e) {
            thrownException = e;
        }
    }

    @Then("the chapter status becomes {string}")
    public void verifyPublishedStatus(String statusStr) {
        assertThat(taskChapter().getStatus()).isEqualTo(ChapterStatus.valueOf(statusStr));
    }

    @Then("a {string} is emitted to notify readers")
    public void verifyEventEmitted(String eventName) {
        assertThat(emittedEvents)
                .anyMatch(e -> e.getClass().getSimpleName().equals(eventName));
    }
    @Given("the team uses the task board for this series")
    public void theTeamUsesTheBoard() {
        currentProject.turnBoardOn();
    }

    @When("{string} puts the {int} raw pages of chapter {int} on the board")
    public void putsRawPagesOnTheBoard(String memberName, int pageCount, int chapter) {
        currentTask = scanlationTaskService.uploadChapterTask(currentProject.getId(), ChapterNumber.of(String.valueOf(chapter)),
                pages("raw", pageCount), UserId.of(memberName));
    }

    @Then("{string} is told {string}")
    public void isTold(String memberName, String message) {
        assertThat(notifications.recent(UserId.of(memberName))).singleElement().satisfies(notification -> {
            assertThat(notification.message()).isEqualTo(message);
            assertThat(notification.link()).isEqualTo("/scanlation/" + currentProject.getId().value());
        });
    }

    @Then("{string} is not told about chapter {int}")
    public void isNotTold(String memberName, int chapter) {
        assertThat(notifications.recent(UserId.of(memberName))).noneMatch(n -> n.message().contains("chapter " + chapter + " "));
    }
    /// A team's first chapter waits for a moderator (US-11): this team already has one out, in another series.
    @Given("the team has published chapters before")
    public void theTeamHasPublishedBefore() {
        Chapter earlier = Chapter.createPublished(WorkId.generate(), ChapterNumber.of("1"), "", List.of(PageAsset.create(1, "p1.webp", null)),
                currentTeam.getId(), UserId.of("LeaderBob"));
        chapterStore.put(earlier.getId(), earlier);
    }

    /// The chapter of the current task (the store may also hold the team's earlier chapters).
    private Chapter taskChapter() {
        return chapterStore.values().stream()
                .filter(chapter -> chapter.getWorkId().equals(currentProject.getWorkId()) && chapter.getChapterNumber().equals(currentTask.getChapterNumber()))
                .findFirst().orElseThrow();
    }
}
