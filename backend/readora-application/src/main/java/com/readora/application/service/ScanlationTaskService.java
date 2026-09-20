package com.readora.application.service;

import com.readora.application.port.in.ManageScanlationTaskUseCase;
import com.readora.application.port.out.ChapterRepositoryPort;
import com.readora.application.port.out.EventPublisherPort;
import com.readora.application.port.out.ScanlationProjectRepositoryPort;
import com.readora.application.port.out.TeamRepositoryPort;
import com.readora.domain.common.NotFoundException;
import com.readora.domain.scanlation.ProjectId;
import com.readora.domain.scanlation.ScanlationProject;
import com.readora.domain.scanlation.TaskId;
import com.readora.domain.scanlation.Team;
import com.readora.domain.scanlation.WorkflowTask;
import com.readora.domain.work.Chapter;
import com.readora.domain.work.PageAsset;
import com.readora.domain.common.UserId;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

public class ScanlationTaskService implements ManageScanlationTaskUseCase {
    private final ScanlationProjectRepositoryPort projectRepository;
    private final TeamRepositoryPort teamRepository;
    private final ChapterRepositoryPort chapterRepository;
    private final EventPublisherPort eventPublisher;

    public ScanlationTaskService(ScanlationProjectRepositoryPort projectRepository, TeamRepositoryPort teamRepository,
                                 ChapterRepositoryPort chapterRepository, EventPublisherPort eventPublisher) {
        this.projectRepository = Objects.requireNonNull(projectRepository, "ScanlationProjectRepositoryPort cannot be null");
        this.teamRepository = Objects.requireNonNull(teamRepository, "TeamRepositoryPort cannot be null");
        this.chapterRepository = Objects.requireNonNull(chapterRepository, "ChapterRepositoryPort cannot be null");
        this.eventPublisher = Objects.requireNonNull(eventPublisher, "EventPublisherPort cannot be null");
    }

    @Override
    public WorkflowTask uploadChapterTask(ProjectId projectId, com.readora.domain.work.ChapterNumber chapterNumber, String assetUrl, int pageCount, UserId userId) {
        ScanlationProject project = requireProject(projectId);

        project.requireMember(requireTeam(project), userId);

        WorkflowTask task = project.addChapterTask(chapterNumber, assetUrl, pageCount);
        projectRepository.save(project);
        project.pollDomainEvents().forEach(eventPublisher::publish);

        if (chapterRepository.findByWorkIdAndChapterNumber(project.getWorkId(), chapterNumber).isEmpty()) {
            Chapter draft = Chapter.createDraft(project.getWorkId(), chapterNumber, "Chapter " + chapterNumber, project.getTeamId());
            if (pageCount > 0) {
                List<PageAsset> pages = new ArrayList<>();
                for (int i = 1; i <= pageCount; i++) {
                    pages.add(PageAsset.create(i, "scans/" + project.getWorkId() + "/" + chapterNumber + "/p" + i + ".webp", null));
                }
                draft.updatePages(pages);
            }
            chapterRepository.save(draft);
            draft.pollDomainEvents().forEach(eventPublisher::publish);
        }

        return task;
    }

    @Override
    public WorkflowTask claimTask(ProjectId projectId, TaskId taskId, UserId userId) {
        ScanlationProject project = requireProject(projectId);

        project.claimTask(requireTeam(project), taskId, userId);
        projectRepository.save(project);
        project.pollDomainEvents().forEach(eventPublisher::publish);

        return project.findTask(taskId).orElseThrow();
    }

    @Override
    public WorkflowTask submitWork(ProjectId projectId, TaskId taskId, UserId userId, String assetUrl, int pageCount) {
        ScanlationProject project = requireProject(projectId);

        project.submitTaskWork(requireTeam(project), taskId, userId, assetUrl, pageCount);
        projectRepository.save(project);
        project.pollDomainEvents().forEach(eventPublisher::publish);

        return project.findTask(taskId).orElseThrow();
    }

    @Override
    public void publishChapterFromQC(ProjectId projectId, TaskId taskId, UserId publisherId) {
        ScanlationProject project = requireProject(projectId);

        // Validate and mutate both aggregates in memory first; persist only once both transitions succeeded.
        WorkflowTask task = project.approveQualityCheck(requireTeam(project), taskId, publisherId);

        // Find or create the chapter to publish
        Chapter chapter = chapterRepository.findByWorkIdAndChapterNumber(project.getWorkId(), task.getChapterNumber())
                .orElseGet(() -> {
                    Chapter c = Chapter.createDraft(project.getWorkId(), task.getChapterNumber(), "Chapter " + task.getChapterNumber(), project.getTeamId());
                    List<PageAsset> pages = new ArrayList<>();
                    for (int i = 1; i <= task.getPageCount(); i++) {
                        pages.add(PageAsset.create(i, "scans/" + project.getWorkId() + "/" + task.getChapterNumber() + "/p" + i + ".webp", null));
                    }
                    c.updatePages(pages);
                    return c;
                });

        if (chapter.getPages().isEmpty() && task.getPageCount() > 0) {
            List<PageAsset> pages = new ArrayList<>();
            for (int i = 1; i <= task.getPageCount(); i++) {
                pages.add(PageAsset.create(i, "scans/" + project.getWorkId() + "/" + task.getChapterNumber() + "/p" + i + ".webp", null));
            }
            chapter.updatePages(pages);
        }

        chapter.publish(publisherId);

        projectRepository.save(project);
        chapterRepository.save(chapter);
        project.pollDomainEvents().forEach(eventPublisher::publish);
        chapter.pollDomainEvents().forEach(eventPublisher::publish);
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
