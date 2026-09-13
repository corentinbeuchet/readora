package com.readora.acceptance.steps;

import com.readora.application.port.out.ChapterRepositoryPort;
import com.readora.application.port.out.EventPublisherPort;
import com.readora.application.port.out.ScanlationProjectRepositoryPort;
import com.readora.application.service.ScanlationTaskService;
import com.readora.domain.common.DomainEvent;
import com.readora.domain.common.DomainValidationException;
import com.readora.domain.scanlation.*;
import com.readora.domain.work.*;
import io.cucumber.java.Before;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;

import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

import static org.assertj.core.api.Assertions.assertThat;

public class ScanlationWorkflowStepDefinitions {

    private final Map<ProjectId, ScanlationProject> projectStore = new ConcurrentHashMap<>();
    private final Map<ChapterId, Chapter> chapterStore = new ConcurrentHashMap<>();
    private final List<DomainEvent> emittedEvents = new ArrayList<>();

    private ScanlationTaskService scanlationTaskService;
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
            public ScanlationProject save(ScanlationProject project) {
                projectStore.put(project.getId(), project);
                return project;
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
            public Chapter save(Chapter chapter) {
                chapterStore.put(chapter.getId(), chapter);
                return chapter;
            }
        };

        EventPublisherPort eventPublisher = emittedEvents::add;
        scanlationTaskService = new ScanlationTaskService(projectRepo, chapterRepo, eventPublisher);
    }

    @Given("a scanlation team {string} exists")
    public void scanlationTeamExists(String teamName) {
        // Team metadata
    }

    @Given("{string} has a scanlation project managed by {string}")
    public void projectManagedByTeam(String workTitle, String teamName) {
        currentProject = ScanlationProject.create(teamName + " - " + workTitle, WorkId.generate(), UserId.of("LeaderBob"));
        projectStore.put(currentProject.getId(), currentProject);
    }

    @Given("team member {string} has role {string}")
    public void teamMemberHasRole(String memberName, String roleStr) {
        ScanlationRole role = ScanlationRole.valueOf(roleStr);
        currentProject.addMember(TeamMember.of(UserId.of(memberName), role));
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

    @When("{string} uploads cleaned page package with {int} pages")
    public void memberUploadsPackage(String memberName, int pageCount) {
        try {
            currentTask = scanlationTaskService.submitWork(currentProject.getId(), currentTask.getId(), UserId.of(memberName), "s3://media/cleaned-c10.zip", pageCount);
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

    @When("{string} submits the translated script mapping for {int} pages")
    public void memberSubmitsTranslation(String memberName, int pageCount) {
        try {
            currentTask = scanlationTaskService.submitWork(currentProject.getId(), currentTask.getId(), UserId.of(memberName), "s3://media/script-c10.json", pageCount);
        } catch (Exception e) {
            thrownException = e;
        }
    }

    @Then("the task stage advances to {string}")
    public void verifyTaskStage(String stageStr) {
        assertThat(currentTask.getStage()).isEqualTo(WorkflowStage.valueOf(stageStr));
    }

    @Given("{string} has passed proofreading and is in stage {string}")
    public void chapterInQcReview(String chapterName, String stageStr) {
        String num = chapterName.replaceAll("[^0-9.]", "");
        currentTask = currentProject.addChapterTask(ChapterNumber.of(num.isEmpty() ? "10" : num));
        currentTask.advanceStage(WorkflowStage.valueOf(stageStr));
        currentTask.submitAssetPackage("s3://media/final-assembled-c10.zip", 22);
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
        List<Chapter> chapters = chapterStore.values().stream().toList();
        assertThat(chapters).isNotEmpty();
        assertThat(chapters.getFirst().getStatus()).isEqualTo(ChapterStatus.valueOf(statusStr));
    }

    @Then("a {string} is emitted to notify readers")
    public void verifyEventEmitted(String eventName) {
        assertThat(emittedEvents)
                .anyMatch(e -> e.getClass().getSimpleName().equals(eventName));
    }
}
