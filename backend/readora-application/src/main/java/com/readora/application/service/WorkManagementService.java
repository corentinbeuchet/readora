package com.readora.application.service;

import com.readora.application.port.in.DirectPublishChapterUseCase;
import com.readora.application.port.in.ManageWorkUseCase;
import com.readora.application.port.out.ChapterRepositoryPort;
import com.readora.application.port.out.EventPublisherPort;
import com.readora.application.port.out.ScanlationProjectRepositoryPort;
import com.readora.application.port.out.TeamRepositoryPort;
import com.readora.application.port.out.UserAccountRepositoryPort;
import com.readora.application.port.out.WorkRepositoryPort;
import com.readora.domain.common.AccessDeniedDomainException;
import com.readora.domain.common.DomainValidationException;
import com.readora.domain.common.ErrorCodes;
import com.readora.domain.common.NotFoundException;
import com.readora.domain.common.UserId;
import com.readora.domain.identity.Permission;
import com.readora.domain.scanlation.ScanlationProject;
import com.readora.domain.scanlation.ScanlationRole;
import com.readora.domain.scanlation.Team;
import com.readora.domain.scanlation.TeamId;
import com.readora.domain.work.*;
import com.readora.domain.work.ChapterStatus;

import java.time.Clock;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;

public class WorkManagementService implements ManageWorkUseCase, DirectPublishChapterUseCase {

    private final WorkRepositoryPort workRepository;
    private final ChapterRepositoryPort chapterRepository;
    private final ScanlationProjectRepositoryPort projectRepository;
    private final TeamRepositoryPort teamRepository;
    private final UserAccountRepositoryPort userRepository;
    private final EventPublisherPort eventPublisher;
    private final Clock clock;

    public WorkManagementService(WorkRepositoryPort workRepository,
                                 ChapterRepositoryPort chapterRepository,
                                 ScanlationProjectRepositoryPort projectRepository,
                                 TeamRepositoryPort teamRepository,
                                 UserAccountRepositoryPort userRepository,
                                 EventPublisherPort eventPublisher,
                                 Clock clock) {
        this.workRepository = Objects.requireNonNull(workRepository, "WorkRepositoryPort cannot be null");
        this.chapterRepository = Objects.requireNonNull(chapterRepository, "ChapterRepositoryPort cannot be null");
        this.projectRepository = Objects.requireNonNull(projectRepository, "ScanlationProjectRepositoryPort cannot be null");
        this.teamRepository = Objects.requireNonNull(teamRepository, "TeamRepositoryPort cannot be null");
        this.userRepository = Objects.requireNonNull(userRepository, "UserAccountRepositoryPort cannot be null");
        this.eventPublisher = Objects.requireNonNull(eventPublisher, "EventPublisherPort cannot be null");
        this.clock = Objects.requireNonNull(clock, "Clock cannot be null");
    }

    @Override
    public Work createWork(NewWork details, UserId creatorId) {
        String title = details.title();
        if (title == null || title.trim().isEmpty()) {
            throw new DomainValidationException("Work title cannot be empty");
        }
        if (title.length() > 255) {
            throw new DomainValidationException("Work title cannot exceed 255 characters");
        }
        if (details.type() == null) {
            throw new DomainValidationException("Work type cannot be null");
        }

        Team ownTeam = details.teamId() != null ? requireLedTeam(details.teamId(), creatorId) : null;
        if (ownTeam == null && !isAdmin(creatorId)) {
            throw DomainValidationException.withCode(ErrorCodes.TEAM_REQUIRED, "A new series belongs to a team you lead: start a team first");
        }

        WorkStatus requested = details.status();
        WorkStatus status = requested != null ? requested : WorkStatus.ONGOING;
        Work work = Work.create(title, details.synopsis(), details.type(), status, details.author(), details.demographic(),
                details.coverImageUrl(), details.genres() != null ? details.genres() : Set.of(), details.facts());
        Work savedWork = workRepository.save(work);

        if (ownTeam != null) {
            projectRepository.save(ScanlationProject.create(ownTeam.getName() + " - " + savedWork.getTitle(), savedWork.getId(), ownTeam.getId()));
        }

        return savedWork;
    }

    @Override
    public Work updateWork(WorkId workId, WorkDescription description, UserId editorId) {
        Work work = workRepository.findById(workId).orElseThrow(() -> new NotFoundException("Work", workId));
        requireSeriesLeaderOrAdmin(work, editorId);
        if (description.title() != null && description.title().length() > 255) {
            throw new DomainValidationException("Work title cannot exceed 255 characters");
        }
        WorkStatus status = description.status() != null ? description.status() : WorkStatus.ONGOING;
        work.describe(description.title(), description.synopsis(), description.type(), status, description.author(),
                description.demographic(), description.coverImageUrl(), description.genres() != null ? description.genres() : Set.of(),
                description.facts(), clock.instant());
        return workRepository.save(work);
    }

    @Override
    public Chapter directPublishChapter(WorkId workId, TeamId teamId, String chapterNumberStr, String title, List<PageAsset> pages,
                                        UserId publisherId) {
        Objects.requireNonNull(workId, "WorkId cannot be null");
        if (workRepository.findById(workId).isEmpty()) {
            throw new NotFoundException("Work", workId);
        }
        authorizePublisher(workId, teamId, publisherId);

        if (chapterNumberStr == null || chapterNumberStr.trim().isEmpty()) {
            throw new DomainValidationException("Chapter number cannot be empty");
        }

        ChapterNumber chapterNumber = ChapterNumber.of(chapterNumberStr.trim());
        // A draft (e.g. sent back by a moderator) is published again; anything else already has this number.
        Optional<Chapter> existing = chapterRepository.findByWorkIdAndChapterNumberAndTeam(workId, chapterNumber, teamId);
        if (existing.isPresent() && existing.get().getStatus() != ChapterStatus.DRAFT) {
            throw DomainValidationException.withCode(ErrorCodes.CHAPTER_ALREADY_EXISTS,
                    "This team already has a chapter " + chapterNumber.value() + " of this series");
        }

        if (pages == null || pages.isEmpty()) {
            throw new DomainValidationException("Cannot publish chapter with zero pages.");
        }

        Chapter chapter = existing.orElseGet(() -> Chapter.createDraft(workId, chapterNumber, title != null ? title : "", teamId));
        chapter.updatePages(pages);
        ChapterRelease.release(chapter, publisherId, chapterRepository, userRepository);
        Chapter savedChapter = chapterRepository.save(chapter);

        chapter.pollDomainEvents().forEach(eventPublisher::publish);

        return savedChapter;
    }

    private boolean isAdmin(UserId userId) {
        return userRepository.findById(userId).map(account -> account.can(Permission.USER_MANAGE)).orElse(false);
    }

    private Team requireLedTeam(TeamId teamId, UserId creatorId) {
        Team team = teamRepository.findById(teamId).orElseThrow(() -> new NotFoundException("Team", teamId));
        if (!team.isLeader(creatorId)) {
            throw new AccessDeniedDomainException("Only a leader of " + team.getName() + " can add a series to it");
        }
        return team;
    }

    /// A series has no owner: it belongs to the teams that translate it, so their leaders keep its page right.
    private void requireSeriesLeaderOrAdmin(Work work, UserId editorId) {
        boolean leadsATeamOfTheSeries = projectRepository.findByWorkId(work.getId()).stream()
                .map(project -> teamRepository.findById(project.getTeamId()))
                .flatMap(Optional::stream)
                .anyMatch(team -> team.isLeader(editorId));
        if (!leadsATeamOfTheSeries && !isAdmin(editorId)) {
            throw new AccessDeniedDomainException("Only a leader of a team that translates " + work.getTitle() + " can edit it");
        }
    }

    /// The chapter is published as `teamId`'s version: the team must work on the series (have a task board for it),
    /// and the publisher must be one of its leaders or quality checkers, or an admin.
    ///
    /// @throws AccessDeniedDomainException for anyone else
    private void authorizePublisher(WorkId workId, TeamId teamId, UserId publisherId) {
        Team team = teamRepository.findById(teamId).orElseThrow(() -> new NotFoundException("Team", teamId));
        boolean onTheTeam = team.findMember(publisherId).filter(m -> m.hasRole(ScanlationRole.QUALITY_CHECKER)).isPresent();
        if (!onTheTeam && !isAdmin(publisherId)) {
            throw new AccessDeniedDomainException("Only a leader or quality checker of " + team.getName() + " can publish its chapters");
        }
        if (projectRepository.findByTeamId(teamId).stream().noneMatch(project -> project.getWorkId().equals(workId))) {
            throw DomainValidationException.withCode(ErrorCodes.TEAM_NOT_ON_SERIES, team.getName() + " does not work on this series yet");
        }
    }
}
