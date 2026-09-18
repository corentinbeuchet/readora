package com.readora.application.service;

import com.readora.application.port.in.ManageScanlationTaskUseCase;
import com.readora.application.port.out.ChapterRepositoryPort;
import com.readora.application.port.out.EventPublisherPort;
import com.readora.application.port.out.ScanlationProjectRepositoryPort;
import com.readora.domain.common.DomainValidationException;
import com.readora.domain.scanlation.ProjectId;
import com.readora.domain.scanlation.ScanlationProject;
import com.readora.domain.scanlation.TaskId;
import com.readora.domain.scanlation.WorkflowTask;
import com.readora.domain.work.Chapter;
import com.readora.domain.work.PageAsset;
import com.readora.domain.work.UserId;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

public class ScanlationTaskService implements ManageScanlationTaskUseCase {
    private final ScanlationProjectRepositoryPort projectRepository;
    private final ChapterRepositoryPort chapterRepository;
    private final EventPublisherPort eventPublisher;

    public ScanlationTaskService(ScanlationProjectRepositoryPort projectRepository, ChapterRepositoryPort chapterRepository, EventPublisherPort eventPublisher) {
        this.projectRepository = Objects.requireNonNull(projectRepository, "ScanlationProjectRepositoryPort cannot be null");
        this.chapterRepository = Objects.requireNonNull(chapterRepository, "ChapterRepositoryPort cannot be null");
        this.eventPublisher = Objects.requireNonNull(eventPublisher, "EventPublisherPort cannot be null");
    }

    @Override
    public WorkflowTask uploadChapterTask(ProjectId projectId, com.readora.domain.work.ChapterNumber chapterNumber, String assetUrl, int pageCount, UserId userId) {
        ScanlationProject project = projectRepository.findById(projectId)
                .orElseThrow(() -> new DomainValidationException("Scanlation project not found: " + projectId));

        if (project.findMember(userId).isEmpty()) {
            throw new DomainValidationException("User " + userId + " is not a member of project " + project.getName());
        }

        WorkflowTask task = project.addChapterTask(chapterNumber, assetUrl, pageCount);
        projectRepository.save(project);
        project.pollDomainEvents().forEach(eventPublisher::publish);

        List<Chapter> chapters = chapterRepository.findByWorkId(project.getWorkId());
        boolean chapterExists = chapters.stream().anyMatch(c -> c.getChapterNumber().equals(chapterNumber));
        if (!chapterExists) {
            Chapter draft = Chapter.createDraft(project.getWorkId(), chapterNumber, "Chapter " + chapterNumber, projectId);
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
        ScanlationProject project = projectRepository.findById(projectId)
                .orElseThrow(() -> new DomainValidationException("Scanlation project not found: " + projectId));

        project.claimTask(taskId, userId);
        projectRepository.save(project);
        project.pollDomainEvents().forEach(eventPublisher::publish);

        return project.findTask(taskId).orElseThrow();
    }

    @Override
    public WorkflowTask submitWork(ProjectId projectId, TaskId taskId, UserId userId, String assetUrl, int pageCount) {
        ScanlationProject project = projectRepository.findById(projectId)
                .orElseThrow(() -> new DomainValidationException("Scanlation project not found: " + projectId));

        project.submitTaskWork(taskId, userId, assetUrl, pageCount);
        projectRepository.save(project);
        project.pollDomainEvents().forEach(eventPublisher::publish);

        return project.findTask(taskId).orElseThrow();
    }

    @Override
    public void publishChapterFromQC(ProjectId projectId, TaskId taskId, UserId publisherId) {
        ScanlationProject project = projectRepository.findById(projectId)
                .orElseThrow(() -> new DomainValidationException("Scanlation project not found: " + projectId));

        WorkflowTask task = project.findTask(taskId)
                .orElseThrow(() -> new DomainValidationException("Task not found: " + taskId));

        // Submit and transition to PUBLISHED
        project.submitTaskWork(taskId, publisherId, task.getAssetPackageUrl(), task.getPageCount());
        projectRepository.save(project);
        project.pollDomainEvents().forEach(eventPublisher::publish);

        // Find or create the chapter to publish
        List<Chapter> chapters = chapterRepository.findByWorkId(project.getWorkId());
        Chapter chapter = chapters.stream()
                .filter(c -> c.getChapterNumber().equals(task.getChapterNumber()))
                .findFirst()
                .orElseGet(() -> {
                    Chapter c = Chapter.createDraft(project.getWorkId(), task.getChapterNumber(), "Chapter " + task.getChapterNumber(), projectId);
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
        chapterRepository.save(chapter);
        chapter.pollDomainEvents().forEach(eventPublisher::publish);
    }
}
