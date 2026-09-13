package com.readora.application.service;

import com.readora.application.port.in.DirectPublishChapterUseCase;
import com.readora.application.port.in.ManageWorkUseCase;
import com.readora.application.port.out.ChapterRepositoryPort;
import com.readora.application.port.out.EventPublisherPort;
import com.readora.application.port.out.ScanlationProjectRepositoryPort;
import com.readora.application.port.out.WorkRepositoryPort;
import com.readora.domain.common.DomainValidationException;
import com.readora.domain.scanlation.ProjectId;
import com.readora.domain.scanlation.ScanlationProject;
import com.readora.domain.work.*;

import java.util.List;
import java.util.Objects;
import java.util.Set;

public class WorkManagementService implements ManageWorkUseCase, DirectPublishChapterUseCase {

    private final WorkRepositoryPort workRepository;
    private final ChapterRepositoryPort chapterRepository;
    private final ScanlationProjectRepositoryPort projectRepository;
    private final EventPublisherPort eventPublisher;

    public WorkManagementService(WorkRepositoryPort workRepository,
                                 ChapterRepositoryPort chapterRepository,
                                 ScanlationProjectRepositoryPort projectRepository,
                                 EventPublisherPort eventPublisher) {
        this.workRepository = Objects.requireNonNull(workRepository, "WorkRepositoryPort cannot be null");
        this.chapterRepository = Objects.requireNonNull(chapterRepository, "ChapterRepositoryPort cannot be null");
        this.projectRepository = Objects.requireNonNull(projectRepository, "ScanlationProjectRepositoryPort cannot be null");
        this.eventPublisher = Objects.requireNonNull(eventPublisher, "EventPublisherPort cannot be null");
    }

    @Override
    public Work createWork(String title, String synopsis, WorkType type, WorkStatus status, String coverImageUrl, Set<String> genres, UserId creatorId) {
        if (title == null || title.trim().isEmpty()) {
            throw new DomainValidationException("Work title cannot be empty");
        }
        if (title.length() > 255) {
            throw new DomainValidationException("Work title cannot exceed 255 characters");
        }
        if (type == null) {
            throw new DomainValidationException("Work type cannot be null");
        }

        Work work = Work.create(title, synopsis, type, status != null ? status : WorkStatus.ONGOING, coverImageUrl, genres);
        Work savedWork = workRepository.save(work);

        if (creatorId != null) {
            String projectName = savedWork.getTitle() + " Workspace";
            ScanlationProject project = ScanlationProject.create(projectName, savedWork.getId(), creatorId);
            projectRepository.save(project);
        }

        return savedWork;
    }

    @Override
    public Chapter directPublishChapter(WorkId workId, String chapterNumberStr, String title, List<PageAsset> pages, UserId publisherId) {
        Objects.requireNonNull(workId, "WorkId cannot be null");
        Work work = workRepository.findById(workId)
                .orElseThrow(() -> new DomainValidationException("Work not found with id: " + workId));

        if (chapterNumberStr == null || chapterNumberStr.trim().isEmpty()) {
            throw new DomainValidationException("Chapter number cannot be empty");
        }

        ChapterNumber chapterNumber = ChapterNumber.of(chapterNumberStr.trim());
        List<Chapter> existingChapters = chapterRepository.findByWorkId(workId);
        boolean duplicate = existingChapters.stream()
                .anyMatch(c -> c.getChapterNumber().equals(chapterNumber));
        if (duplicate) {
            throw new DomainValidationException("Chapter " + chapterNumberStr + " already exists for this work");
        }

        if (pages == null || pages.isEmpty()) {
            throw new DomainValidationException("Cannot publish chapter with zero pages.");
        }

        ProjectId projectId = projectRepository.findByWorkId(workId).stream()
                .findFirst()
                .map(ScanlationProject::getId)
                .orElse(null);

        Chapter chapter = Chapter.createPublished(workId, chapterNumber, title != null ? title : "", pages, projectId, publisherId);
        Chapter savedChapter = chapterRepository.save(chapter);

        chapter.pollDomainEvents().forEach(eventPublisher::publish);

        return savedChapter;
    }
}
