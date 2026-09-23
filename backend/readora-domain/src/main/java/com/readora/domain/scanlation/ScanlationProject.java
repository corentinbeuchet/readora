package com.readora.domain.scanlation;

import com.readora.domain.common.AggregateRoot;
import com.readora.domain.common.DomainValidationException;
import com.readora.domain.common.ErrorCodes;
import com.readora.domain.common.NotFoundException;
import com.readora.domain.common.UserId;
import com.readora.domain.work.ChapterNumber;
import com.readora.domain.work.WorkId;
import org.jspecify.annotations.Nullable;

import java.time.Instant;
import java.util.*;

/// A team's task board for one series. The roster lives on the [Team]: operations that need a member take the
/// project's own team and check roles there.
public class ScanlationProject extends AggregateRoot<ProjectId> {
    private final String name;
    private final WorkId workId;
    private final TeamId teamId;
    private final List<WorkflowTask> tasks = new ArrayList<>();
    private boolean boardEnabled;
    private final Instant createdAt;
    private Instant updatedAt;

    public ScanlationProject(ProjectId id, String name, WorkId workId, TeamId teamId, @Nullable List<WorkflowTask> tasks,
                             boolean boardEnabled, @Nullable Instant createdAt, @Nullable Instant updatedAt) {
        super(id);
        this.name = validateName(name);
        this.workId = Objects.requireNonNull(workId, "WorkId cannot be null");
        this.teamId = Objects.requireNonNull(teamId, "TeamId cannot be null");
        if (tasks != null) {
            this.tasks.addAll(tasks);
        }
        this.boardEnabled = boardEnabled;
        this.createdAt = createdAt != null ? createdAt : Instant.now();
        this.updatedAt = updatedAt != null ? updatedAt : this.createdAt;
    }

    /// A team's new series, without a task board: most teams only publish finished chapters (see [#turnBoardOn()]).
    public static ScanlationProject create(String name, WorkId workId, TeamId teamId) {
        Instant now = Instant.now();
        return new ScanlationProject(ProjectId.generate(), name, workId, teamId, List.of(), false, now, now);
    }

    public void turnBoardOn() {
        this.boardEnabled = true;
        this.updatedAt = Instant.now();
    }

    /// Tasks already on the board stay and can still be finished; no new chapter goes on it.
    public void turnBoardOff() {
        this.boardEnabled = false;
        this.updatedAt = Instant.now();
    }

    /// @throws DomainValidationException `BOARD_OFF` if the team does not use a task board for this series
    public void requireBoard() {
        if (!boardEnabled) {
            throw DomainValidationException.withCode(ErrorCodes.BOARD_OFF, "The task board of " + name + " is off: a leader turns it on first");
        }
    }

    public boolean isBoardEnabled() {
        return boardEnabled;
    }

    private static String validateName(String name) {
        if (name == null || name.trim().isEmpty()) {
            throw new DomainValidationException("Scanlation project name cannot be empty");
        }
        return name.trim();
    }

    /// @throws DomainValidationException if the user is not on the project's team
    public TeamMember requireMember(Team team, UserId userId) {
        if (!team.getId().equals(teamId)) {
            throw new IllegalArgumentException("Team " + team.getId() + " does not own project " + name);
        }
        return team.findMember(userId)
                .orElseThrow(() -> new DomainValidationException("User " + userId + " is not a member of project " + name));
    }

    public WorkflowTask addChapterTask(ChapterNumber chapterNumber) {
        return addChapterTask(chapterNumber, null, 0);
    }

    public WorkflowTask addChapterTask(ChapterNumber chapterNumber, @Nullable String assetUrl, int pageCount) {
        if (findTaskByChapter(chapterNumber).isPresent()) {
            throw DomainValidationException.withCode(ErrorCodes.TASK_ALREADY_EXISTS, "Task for chapter " + chapterNumber + " already exists in project " + name);
        }
        WorkflowTask task = WorkflowTask.create(chapterNumber, assetUrl, pageCount);
        this.tasks.add(task);
        this.updatedAt = Instant.now();
        return task;
    }

    public Optional<WorkflowTask> findTask(TaskId taskId) {
        return this.tasks.stream().filter(t -> t.getId().equals(taskId)).findFirst();
    }

    public Optional<WorkflowTask> findTaskByChapter(ChapterNumber chapterNumber) {
        return this.tasks.stream().filter(t -> t.getChapterNumber().equals(chapterNumber)).findFirst();
    }

    public void claimTask(Team team, TaskId taskId, UserId userId) {
        TeamMember member = requireMember(team, userId);

        WorkflowTask task = findTask(taskId)
                .orElseThrow(() -> new NotFoundException("Task", taskId));

        requireOpenStage(task);
        ScanlationRole required = task.getStage().requiredRole();
        if (!member.hasRole(required)) {
            throw new DomainValidationException("User lacks required role: " + required + " for stage: " + task.getStage());
        }
        if (isHeldBySomeoneElse(task, userId) && !isLeader(member)) {
            throw DomainValidationException.withCode(ErrorCodes.TASK_ALREADY_CLAIMED, "Task is already claimed by " + task.getAssigneeId());
        }

        task.assignTo(userId);
        this.updatedAt = Instant.now();
    }

    public void submitTaskWork(Team team, TaskId taskId, UserId userId, @Nullable String assetUrl, int pageCount) {
        WorkflowTask task = findTask(taskId)
                .orElseThrow(() -> new NotFoundException("Task", taskId));

        requireOpenStage(task);
        if (task.getStage() == WorkflowStage.QC_REVIEW) {
            throw new DomainValidationException("A task in QC_REVIEW is published through QC approval, not submitted");
        }
        if (task.getAssigneeId() == null || !task.getAssigneeId().equals(userId)) {
            // Unassigned: any member with the stage role may submit directly. Assigned to someone else: leader override only.
            TeamMember member = requireMember(team, userId);
            if (!member.hasRole(task.getStage().requiredRole())) {
                throw new DomainValidationException("User lacks required role: " + task.getStage().requiredRole());
            }
            if (isHeldBySomeoneElse(task, userId) && !isLeader(member)) {
                throw DomainValidationException.withCode(ErrorCodes.TASK_CLAIMED_BY_OTHER, "Task is claimed by " + task.getAssigneeId() + "; only they or the leader can submit it");
            }
        }

        task.submitAssetPackage(assetUrl, pageCount);
        WorkflowStage current = task.getStage();
        // The cleaner works directly on the uploaded RAWs, so submitting the cleaned package
        // completes the CLEANING stage and hands the chapter over to translation.
        WorkflowStage next = current == WorkflowStage.RAW_UPLOADED
                ? WorkflowStage.TRANSLATING
                : current.nextStage();
        task.advanceStage(next);
        this.updatedAt = Instant.now();
    }

    /// Final QC approval: moves a task from `QC_REVIEW` to `PUBLISHED`.
    ///
    /// @throws DomainValidationException if the user is not a member with the `QUALITY_CHECKER` role (leaders
    ///         qualify), or if the task is not in `QC_REVIEW` — translation, typesetting and proofreading can't be skipped
    public WorkflowTask approveQualityCheck(Team team, TaskId taskId, UserId userId) {
        TeamMember member = requireMember(team, userId);
        WorkflowTask task = findTask(taskId)
                .orElseThrow(() -> new NotFoundException("Task", taskId));

        if (task.getStage() != WorkflowStage.QC_REVIEW) {
            throw new DomainValidationException("Only a task in QC_REVIEW can be published; this one is in " + task.getStage());
        }
        if (!member.hasRole(ScanlationRole.QUALITY_CHECKER)) {
            throw new DomainValidationException("User lacks required role: " + ScanlationRole.QUALITY_CHECKER);
        }

        task.advanceStage(WorkflowStage.PUBLISHED);
        this.updatedAt = Instant.now();
        return task;
    }

    private static void requireOpenStage(WorkflowTask task) {
        if (task.getStage() == WorkflowStage.PUBLISHED) {
            throw new DomainValidationException("Task for chapter " + task.getChapterNumber() + " is already published");
        }
    }

    private static boolean isHeldBySomeoneElse(WorkflowTask task, UserId userId) {
        return task.getStatus() == TaskStatus.IN_PROGRESS && task.getAssigneeId() != null && !task.getAssigneeId().equals(userId);
    }

    private static boolean isLeader(TeamMember member) {
        return member.roles().contains(ScanlationRole.LEADER);
    }

    public String getName() {
        return name;
    }

    public WorkId getWorkId() {
        return workId;
    }

    public TeamId getTeamId() {
        return teamId;
    }

    public List<WorkflowTask> getTasks() {
        return Collections.unmodifiableList(tasks);
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
