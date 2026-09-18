package com.readora.application.service;

import com.readora.domain.common.UserId;
import com.readora.application.port.in.DirectPublishChapterUseCase;
import com.readora.application.port.in.ManageWorkUseCase;
import com.readora.application.port.out.ChapterRepositoryPort;
import com.readora.application.port.out.EventPublisherPort;
import com.readora.application.port.out.ScanlationProjectRepositoryPort;
import com.readora.application.port.out.UserAccountRepositoryPort;
import com.readora.application.port.out.WorkRepositoryPort;
import com.readora.domain.common.AccessDeniedDomainException;
import com.readora.domain.common.DomainValidationException;
import com.readora.domain.common.NotFoundException;
import com.readora.domain.identity.Permission;
import com.readora.domain.scanlation.ProjectId;
import com.readora.domain.scanlation.ScanlationProject;
import com.readora.domain.scanlation.ScanlationRole;
import com.readora.domain.work.*;

import java.util.List;
import java.util.Objects;
import java.util.Set;

public class WorkManagementService implements ManageWorkUseCase, DirectPublishChapterUseCase {

    private final WorkRepositoryPort workRepository;
    private final ChapterRepositoryPort chapterRepository;
    private final ScanlationProjectRepositoryPort projectRepository;
    private final UserAccountRepositoryPort userRepository;
    private final EventPublisherPort eventPublisher;

    public WorkManagementService(WorkRepositoryPort workRepository,
                                 ChapterRepositoryPort chapterRepository,
                                 ScanlationProjectRepositoryPort projectRepository,
                                 UserAccountRepositoryPort userRepository,
                                 EventPublisherPort eventPublisher) {
        this.workRepository = Objects.requireNonNull(workRepository, "WorkRepositoryPort cannot be null");
        this.chapterRepository = Objects.requireNonNull(chapterRepository, "ChapterRepositoryPort cannot be null");
        this.projectRepository = Objects.requireNonNull(projectRepository, "ScanlationProjectRepositoryPort cannot be null");
        this.userRepository = Objects.requireNonNull(userRepository, "UserAccountRepositoryPort cannot be null");
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
        if (workRepository.findById(workId).isEmpty()) {
            throw new NotFoundException("Work", workId);
        }
        ProjectId projectId = authorizePublisher(workId, publisherId);

        if (chapterNumberStr == null || chapterNumberStr.trim().isEmpty()) {
            throw new DomainValidationException("Chapter number cannot be empty");
        }

        ChapterNumber chapterNumber = ChapterNumber.of(chapterNumberStr.trim());
        if (chapterRepository.findByWorkIdAndChapterNumber(workId, chapterNumber).isPresent()) {
            throw new DomainValidationException("Chapter " + chapterNumberStr + " already exists for this work");
        }

        if (pages == null || pages.isEmpty()) {
            throw new DomainValidationException("Cannot publish chapter with zero pages.");
        }

        Chapter chapter = Chapter.createPublished(workId, chapterNumber, title != null ? title : "", pages, projectId, publisherId);
        Chapter savedChapter = chapterRepository.save(chapter);

        chapter.pollDomainEvents().forEach(eventPublisher::publish);

        return savedChapter;
    }

    /// Only a leader or quality checker of one of the work's scanlation projects (or an admin) may publish into it.
    ///
    /// @return the project the chapter is attributed to, or `null` for an admin publishing a work without a project
    /// @throws AccessDeniedDomainException for anyone else — the global `CHAPTER_PUBLISH` permission is not enough
    private ProjectId authorizePublisher(WorkId workId, UserId publisherId) {
        List<ScanlationProject> projects = projectRepository.findByWorkId(workId);
        var memberProject = projects.stream()
                .filter(p -> p.findMember(publisherId).filter(m -> m.hasRole(ScanlationRole.QUALITY_CHECKER)).isPresent())
                .findFirst();
        if (memberProject.isPresent()) {
            return memberProject.get().getId();
        }
        boolean admin = userRepository.findById(publisherId).map(account -> account.can(Permission.USER_MANAGE)).orElse(false);
        if (!admin) {
            throw new AccessDeniedDomainException("Only a leader or quality checker of this work's scanlation project can publish chapters");
        }
        return projects.stream().findFirst().map(ScanlationProject::getId).orElse(null);
    }
}
