package com.readora.application.service;

import com.readora.application.port.in.ManageScanlationTaskUseCase;
import com.readora.application.port.out.ChapterRepositoryPort;
import com.readora.application.port.out.EventPublisherPort;
import com.readora.application.port.out.ScanlationProjectRepositoryPort;
import com.readora.application.port.out.TeamRepositoryPort;
import com.readora.application.port.out.UserAccountRepositoryPort;
import com.readora.domain.common.DomainValidationException;
import com.readora.domain.common.ErrorCodes;
import com.readora.domain.common.NotFoundException;
import com.readora.domain.common.UserId;
import com.readora.domain.scanlation.ProjectId;
import com.readora.domain.scanlation.ScanlationProject;
import com.readora.domain.scanlation.TaskId;
import com.readora.domain.scanlation.Team;
import com.readora.domain.scanlation.WorkflowTask;
import com.readora.domain.work.Chapter;
import com.readora.domain.work.ChapterNumber;
import com.readora.domain.work.PageAsset;

import java.util.List;
import java.util.Objects;

public class ScanlationTaskService implements ManageScanlationTaskUseCase {
    private final ScanlationProjectRepositoryPort projectRepository;
    private final TeamRepositoryPort teamRepository;
    private final ChapterRepositoryPort chapterRepository;
    private final EventPublisherPort eventPublisher;
    private final UserAccountRepositoryPort users;

    public ScanlationTaskService(ScanlationProjectRepositoryPort projectRepository, TeamRepositoryPort teamRepository,
                                 ChapterRepositoryPort chapterRepository, EventPublisherPort eventPublisher,
                                 UserAccountRepositoryPort users) {
        this.projectRepository = Objects.requireNonNull(projectRepository, "ScanlationProjectRepositoryPort cannot be null");
        this.teamRepository = Objects.requireNonNull(teamRepository, "TeamRepositoryPort cannot be null");
        this.chapterRepository = Objects.requireNonNull(chapterRepository, "ChapterRepositoryPort cannot be null");
        this.eventPublisher = Objects.requireNonNull(eventPublisher, "EventPublisherPort cannot be null");
        this.users = Objects.requireNonNull(users, "UserAccountRepositoryPort cannot be null");
    }

    @Override
    public WorkflowTask uploadChapterTask(ProjectId projectId, ChapterNumber chapterNumber, List<PageAsset> rawPages, UserId userId) {
        ScanlationProject project = requireProject(projectId);

        project.requireMember(requireTeam(project), userId);
        project.requireBoard();

        WorkflowTask task = project.addChapterTask(chapterNumber, rawPages, userId);
        projectRepository.save(project);
        project.pollDomainEvents().forEach(eventPublisher::publish);
        return task;
    }

    @Override
    public WorkflowTask claimTask(ProjectId projectId, TaskId taskId, UserId userId) {
        ScanlationProject project = requireProject(projectId);

        project.claimTask(requireTeam(project), taskId, userId);
        projectRepository.save(project);

        return project.findTask(taskId).orElseThrow();
    }

    @Override
    public WorkflowTask submitWork(ProjectId projectId, TaskId taskId, UserId userId, List<PageAsset> pages) {
        ScanlationProject project = requireProject(projectId);

        project.submitTaskWork(requireTeam(project), taskId, userId, pages);
        projectRepository.save(project);
        project.pollDomainEvents().forEach(eventPublisher::publish);

        return project.findTask(taskId).orElseThrow();
    }

    @Override
    public Chapter publishChapterFromQC(ProjectId projectId, TaskId taskId, UserId publisherId) {
        ScanlationProject project = requireProject(projectId);

        // Validate and mutate both aggregates in memory first; persist only once both transitions succeeded.
        WorkflowTask task = project.approveQualityCheck(requireTeam(project), taskId, publisherId);

        // The chapter gets the pages the last stage uploaded (an earlier draft of the chapter keeps its identity).
        List<PageAsset> pages = task.getPages();
        if (pages.isEmpty()) {
            throw DomainValidationException.withCode(ErrorCodes.TASK_HAS_NO_PAGES,
                    "Chapter " + task.getChapterNumber().value() + " has no pages: upload them before publishing");
        }
        Chapter chapter = chapterRepository.findByWorkIdAndChapterNumberAndTeam(project.getWorkId(), task.getChapterNumber(), project.getTeamId())
                .orElseGet(() -> Chapter.createDraft(project.getWorkId(), task.getChapterNumber(), "Chapter " + task.getChapterNumber(), project.getTeamId()));
        chapter.updatePages(pages);
        ChapterRelease.release(chapter, publisherId, chapterRepository, users);

        projectRepository.save(project);
        chapterRepository.save(chapter);
        chapter.pollDomainEvents().forEach(eventPublisher::publish);
        return chapter;
    }

    private Team requireTeam(ScanlationProject project) {
        return teamRepository.findById(project.getTeamId())
                .orElseThrow(() -> new NotFoundException("Team", project.getTeamId()));
    }

    private ScanlationProject requireProject(ProjectId projectId) {
        return projectRepository.findById(projectId)
                .orElseThrow(() -> new NotFoundException("Scanlation project", projectId));
    }
}
