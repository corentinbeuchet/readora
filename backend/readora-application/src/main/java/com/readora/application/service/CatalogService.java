package com.readora.application.service;

import com.readora.domain.identity.Permission;
import com.readora.domain.common.UserId;
import com.readora.domain.common.AccessDeniedDomainException;
import com.readora.application.port.out.UserAccountRepositoryPort;
import com.readora.application.port.in.BrowseCatalogUseCase;
import com.readora.application.port.out.ChapterRepositoryPort;
import com.readora.application.port.out.ScanlationProjectRepositoryPort;
import com.readora.application.port.out.TeamRepositoryPort;
import com.readora.application.port.out.WorkRepositoryPort;
import com.readora.application.port.out.WorkRepositoryPort.WorkPage;
import com.readora.application.port.out.WorkRepositoryPort.WorkSearch;
import com.readora.domain.common.DomainValidationException;
import com.readora.domain.scanlation.ProjectId;
import com.readora.domain.scanlation.ScanlationProject;
import com.readora.domain.scanlation.Team;
import com.readora.domain.scanlation.TeamCredit;
import com.readora.domain.scanlation.TeamId;
import com.readora.domain.work.Chapter;
import com.readora.domain.work.Work;
import com.readora.domain.work.WorkId;

import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

public class CatalogService implements BrowseCatalogUseCase {
    public static final int MAX_PAGE_SIZE = 100;

    private final WorkRepositoryPort workRepository;
    private final ChapterRepositoryPort chapterRepository;
    private final ScanlationProjectRepositoryPort projectRepository;
    private final TeamRepositoryPort teamRepository;
    private final UserAccountRepositoryPort userRepository;

    public CatalogService(WorkRepositoryPort workRepository, ChapterRepositoryPort chapterRepository,
                          ScanlationProjectRepositoryPort projectRepository, TeamRepositoryPort teamRepository,
                          UserAccountRepositoryPort userRepository) {
        this.workRepository = Objects.requireNonNull(workRepository, "WorkRepositoryPort cannot be null");
        this.chapterRepository = Objects.requireNonNull(chapterRepository, "ChapterRepositoryPort cannot be null");
        this.projectRepository = Objects.requireNonNull(projectRepository, "ScanlationProjectRepositoryPort cannot be null");
        this.teamRepository = Objects.requireNonNull(teamRepository, "TeamRepositoryPort cannot be null");
        this.userRepository = Objects.requireNonNull(userRepository, "UserAccountRepositoryPort cannot be null");
    }

    @Override
    public Page<Work> searchWorks(CatalogQuery query, int page, int size) {
        int safePage = Math.max(0, page);
        int safeSize = Math.min(Math.max(1, size), MAX_PAGE_SIZE);
        String rawText = query.text();
        String text = rawText == null || rawText.isBlank() ? null : rawText.trim();
        if (text != null && text.length() > CatalogQuery.MAX_TEXT_LENGTH) {
            throw new DomainValidationException("Search text cannot exceed " + CatalogQuery.MAX_TEXT_LENGTH + " characters");
        }
        if (query.includedGenres().size() + query.excludedGenres().size() > CatalogQuery.MAX_GENRES) {
            throw new DomainValidationException("Cannot filter on more than " + CatalogQuery.MAX_GENRES + " genres");
        }
        WorkSearch search = new WorkSearch(text, lowerCased(query.includedGenres()), lowerCased(query.excludedGenres()),
                query.types(), query.statuses(), query.demographics());
        WorkPage result = workRepository.search(search, safePage, safeSize);
        return new Page<>(result.items(), safePage, safeSize, result.totalElements());
    }

    @Override
    public List<String> listGenres() {
        return workRepository.findAllGenres();
    }

    private static Set<String> lowerCased(Set<String> genres) {
        return genres.stream()
                .filter(genre -> !genre.isBlank())
                .map(genre -> genre.trim().toLowerCase(Locale.ROOT))
                .collect(Collectors.toUnmodifiableSet());
    }

    @Override
    public Optional<Work> getWork(WorkId workId) {
        return workRepository.findById(workId);
    }

    @Override
    public List<CreditedChapter> listPublishedChapters(WorkId workId) {
        List<Chapter> chapters = chapterRepository.findPublishedByWorkId(workId);
        Map<TeamId, TeamCredit> credits = teamRepository.findAllById(chapters.stream().map(Chapter::getTeamId).distinct().toList()).stream()
                .collect(Collectors.toMap(Team::getId, TeamCredit::of));
        return chapters.stream()
                .flatMap(chapter -> Optional.ofNullable(credits.get(chapter.getTeamId())).map(team -> new CreditedChapter(chapter, team)).stream())
                .toList();
    }

    @Override
    public Optional<ProjectBoard> getProject(ProjectId projectId, UserId viewer) {
        Optional<ProjectBoard> board = projectRepository.findById(projectId)
                .flatMap(project -> teamRepository.findById(project.getTeamId()).map(team -> new ProjectBoard(project, team)));
        if (board.isPresent() && board.get().team().findMember(viewer).isEmpty() && !isAdmin(viewer)) {
            throw new AccessDeniedDomainException("Only the team's members can open its task board");
        }
        return board;
    }

    @Override
    public List<ProjectBoard> listProjectsByWork(WorkId workId, UserId viewer) {
        boolean admin = isAdmin(viewer);
        List<ScanlationProject> projects = projectRepository.findByWorkId(workId);
        Map<TeamId, Team> teams = teamRepository.findAllById(projects.stream().map(ScanlationProject::getTeamId).toList()).stream()
                .collect(Collectors.toMap(Team::getId, team -> team));
        return projects.stream()
                .flatMap(project -> Optional.ofNullable(teams.get(project.getTeamId())).map(team -> new ProjectBoard(project, team)).stream())
                .filter(board -> admin || board.team().findMember(viewer).isPresent())
                .toList();
    }

    private boolean isAdmin(UserId userId) {
        return userRepository.findById(userId).map(account -> account.can(Permission.USER_MANAGE)).orElse(false);
    }
}
