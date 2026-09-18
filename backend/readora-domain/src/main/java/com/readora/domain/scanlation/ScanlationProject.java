package com.readora.domain.scanlation;

import com.readora.domain.common.AggregateRoot;
import com.readora.domain.common.DomainValidationException;
import com.readora.domain.work.ChapterNumber;
import com.readora.domain.work.UserId;
import com.readora.domain.work.WorkId;

import java.time.Instant;
import java.util.*;

public class ScanlationProject extends AggregateRoot<ProjectId> {
    private final String name;
    private final WorkId workId;
    private final Set<TeamMember> members = new HashSet<>();
    private final List<WorkflowTask> tasks = new ArrayList<>();
    private final Instant createdAt;
    private Instant updatedAt;

    public ScanlationProject(ProjectId id, String name, WorkId workId, Set<TeamMember> members, List<WorkflowTask> tasks, Instant createdAt, Instant updatedAt) {
        super(id);
        this.name = validateName(name);
        this.workId = Objects.requireNonNull(workId, "WorkId cannot be null");
        if (members != null) {
            this.members.addAll(members);
        }
        if (tasks != null) {
            this.tasks.addAll(tasks);
        }
        this.createdAt = createdAt != null ? createdAt : Instant.now();
        this.updatedAt = updatedAt != null ? updatedAt : this.createdAt;
    }

    public static ScanlationProject create(String name, WorkId workId, UserId leaderId) {
        Instant now = Instant.now();
        ScanlationProject project = new ScanlationProject(ProjectId.generate(), name, workId, Set.of(), List.of(), now, now);
        project.addMember(TeamMember.of(leaderId, ScanlationRole.LEADER));
        return project;
    }

    private static String validateName(String name) {
        if (name == null || name.trim().isEmpty()) {
            throw new DomainValidationException("Scanlation project name cannot be empty");
        }
        return name.trim();
    }

    public void addMember(TeamMember member) {
        Objects.requireNonNull(member, "TeamMember cannot be null");
        this.members.remove(member);
        this.members.add(member);
        this.updatedAt = Instant.now();
    }

    public Optional<TeamMember> findMember(UserId userId) {
        return this.members.stream().filter(m -> m.userId().equals(userId)).findFirst();
    }

    public WorkflowTask addChapterTask(ChapterNumber chapterNumber) {
        return addChapterTask(chapterNumber, null, 0);
    }

    public WorkflowTask addChapterTask(ChapterNumber chapterNumber, String assetUrl, int pageCount) {
        if (findTaskByChapter(chapterNumber).isPresent()) {
            throw new DomainValidationException("Task for chapter " + chapterNumber + " already exists in project " + name);
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

    public void claimTask(TaskId taskId, UserId userId) {
        TeamMember member = findMember(userId)
                .orElseThrow(() -> new DomainValidationException("User " + userId + " is not a member of project " + name));

        WorkflowTask task = findTask(taskId)
                .orElseThrow(() -> new DomainValidationException("Task not found with id: " + taskId));

        ScanlationRole required = task.getStage().requiredRole();
        if (!member.hasRole(required)) {
            throw new DomainValidationException("User lacks required role: " + required + " for stage: " + task.getStage());
        }

        task.assignTo(userId);
        this.updatedAt = Instant.now();
        registerEvent(TaskAssignedEvent.now(this.id, taskId, userId, task.getStage()));
    }

    public void submitTaskWork(TaskId taskId, UserId userId, String assetUrl, int pageCount) {
        WorkflowTask task = findTask(taskId)
                .orElseThrow(() -> new DomainValidationException("Task not found with id: " + taskId));

        if (task.getAssigneeId() == null || !task.getAssigneeId().equals(userId)) {
            // Leader override or direct claim
            TeamMember member = findMember(userId)
                    .orElseThrow(() -> new DomainValidationException("User is not a member of project: " + name));
            if (!member.hasRole(task.getStage().requiredRole())) {
                throw new DomainValidationException("User lacks required role: " + task.getStage().requiredRole());
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

        registerEvent(TaskStageAdvancedEvent.now(this.id, taskId, current, next));
        if (next == WorkflowStage.PUBLISHED) {
            registerEvent(WorkflowCompletedEvent.now(this.id, task.getChapterNumber()));
        }
    }

    /// Final QC approval: moves a task from `QC_REVIEW` to `PUBLISHED`.
    ///
    /// @throws DomainValidationException if the user is not a member with the `QUALITY_CHECKER` role (leaders
    ///         qualify), or if the task is not in `QC_REVIEW` — translation, typesetting and proofreading can't be skipped
    public WorkflowTask approveQualityCheck(TaskId taskId, UserId userId) {
        TeamMember member = findMember(userId)
                .orElseThrow(() -> new DomainValidationException("User " + userId + " is not a member of project " + name));
        WorkflowTask task = findTask(taskId)
                .orElseThrow(() -> new DomainValidationException("Task not found with id: " + taskId));

        if (task.getStage() != WorkflowStage.QC_REVIEW) {
            throw new DomainValidationException("Only a task in QC_REVIEW can be published; this one is in " + task.getStage());
        }
        if (!member.hasRole(ScanlationRole.QUALITY_CHECKER)) {
            throw new DomainValidationException("User lacks required role: " + ScanlationRole.QUALITY_CHECKER);
        }

        task.advanceStage(WorkflowStage.PUBLISHED);
        this.updatedAt = Instant.now();
        registerEvent(TaskStageAdvancedEvent.now(this.id, taskId, WorkflowStage.QC_REVIEW, WorkflowStage.PUBLISHED));
        registerEvent(WorkflowCompletedEvent.now(this.id, task.getChapterNumber()));
        return task;
    }

    public String getName() {
        return name;
    }

    public WorkId getWorkId() {
        return workId;
    }

    public Set<TeamMember> getMembers() {
        return Collections.unmodifiableSet(members);
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
