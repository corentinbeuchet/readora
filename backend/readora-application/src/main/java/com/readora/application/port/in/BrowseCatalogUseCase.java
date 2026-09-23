package com.readora.application.port.in;

import com.readora.domain.common.UserId;
import com.readora.domain.scanlation.ProjectId;
import com.readora.domain.scanlation.ScanlationProject;
import com.readora.domain.scanlation.Team;
import com.readora.domain.scanlation.TeamCredit;
import com.readora.domain.work.Chapter;
import com.readora.domain.work.Demographic;
import com.readora.domain.work.Work;
import com.readora.domain.work.WorkId;
import com.readora.domain.work.WorkStatus;
import com.readora.domain.work.WorkType;
import org.jspecify.annotations.Nullable;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

public interface BrowseCatalogUseCase {

    record Page<T>(List<T> items, int page, int size, long totalElements) {
        public int totalPages() {
            return size == 0 ? 0 : (int) Math.ceil((double) totalElements / size);
        }
    }

    /// What a reader filters the catalog on (US-04). Empty sets and a `null`/blank text don't filter.
    /// Genres compare case-insensitively: every `includedGenres` entry must be present, no `excludedGenres` entry may be.
    /// `text` matches part of the title or the author.
    record CatalogQuery(@Nullable String text, Set<String> includedGenres, Set<String> excludedGenres,
                        Set<WorkType> types, Set<WorkStatus> statuses, Set<Demographic> demographics) {
        public static final int MAX_TEXT_LENGTH = 100;
        public static final int MAX_GENRES = 20;

        public CatalogQuery {
            includedGenres = Set.copyOf(includedGenres);
            excludedGenres = Set.copyOf(excludedGenres);
            types = Set.copyOf(types);
            statuses = Set.copyOf(statuses);
            demographics = Set.copyOf(demographics);
        }

        public static CatalogQuery everything() {
            return new CatalogQuery(null, Set.of(), Set.of(), Set.of(), Set.of(), Set.of());
        }
    }

    /// Works matching `query`, most recently updated first. Page and size are clamped to valid values.
    ///
    /// @throws com.readora.domain.common.DomainValidationException if the text or the genre lists are too long
    Page<Work> searchWorks(CatalogQuery query, int page, int size);

    /// Every genre used in the catalog, sorted, to build the genre filter.
    List<String> listGenres();

    Optional<Work> getWork(WorkId workId);
    /// A published chapter with the team that translated it.
    record CreditedChapter(Chapter chapter, TeamCredit team) {
    }

    /// Published chapters of a series in reading order.
    List<CreditedChapter> listPublishedChapters(WorkId workId);
    /// A team's task board for one series, with the team whose roster works on it and the usernames of the people
    /// on it (members and task assignees), so nobody is shown by account id.
    record ProjectBoard(ScanlationProject project, Team team, Map<UserId, String> usernames) {
        public ProjectBoard {
            usernames = Map.copyOf(usernames);
        }

        /// `null` when the account no longer exists.
        public @Nullable String usernameOf(UserId userId) {
            return usernames.get(userId);
        }
    }

    /// A task board, for the members of its team (and admins).
    ///
    /// @throws com.readora.domain.common.AccessDeniedDomainException if the viewer is not on the team
    Optional<ProjectBoard> getProject(ProjectId projectId, UserId viewer);

    /// The task boards of a series that the viewer's teams run (every board for an admin).
    List<ProjectBoard> listProjectsByWork(WorkId workId, UserId viewer);
}
