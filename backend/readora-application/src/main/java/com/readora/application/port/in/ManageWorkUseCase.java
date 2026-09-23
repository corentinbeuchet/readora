package com.readora.application.port.in;

import com.readora.domain.common.UserId;
import com.readora.domain.scanlation.TeamId;
import com.readora.domain.work.Demographic;
import com.readora.domain.work.Work;
import com.readora.domain.work.WorkFacts;
import com.readora.domain.work.WorkId;
import com.readora.domain.work.WorkStatus;
import com.readora.domain.work.WorkType;
import org.jspecify.annotations.Nullable;

import java.util.Set;

public interface ManageWorkUseCase {

    /// A work as its creator describes it; a `null` status means `ONGOING`.
    ///
    /// @param teamId the team the creator leads that will translate the series (it gets a task board); only an admin
    ///               may leave it `null`, to add a series no team works on yet
    record NewWork(String title, @Nullable String synopsis, WorkType type, @Nullable WorkStatus status,
                   @Nullable String author, @Nullable Demographic demographic,
                   @Nullable String coverImageUrl, Set<String> genres, WorkFacts facts, @Nullable TeamId teamId) {

        public NewWork(String title, @Nullable String synopsis, WorkType type, @Nullable WorkStatus status, @Nullable String author,
                       @Nullable Demographic demographic, @Nullable String coverImageUrl, Set<String> genres, @Nullable TeamId teamId) {
            this(title, synopsis, type, status, author, demographic, coverImageUrl, genres, WorkFacts.none(), teamId);
        }

        public NewWork(String title, @Nullable String synopsis, WorkType type, @Nullable WorkStatus status, @Nullable String author,
                       @Nullable Demographic demographic, @Nullable String coverImageUrl, Set<String> genres) {
            this(title, synopsis, type, status, author, demographic, coverImageUrl, genres, WorkFacts.none(), null);
        }
    }

    /// How a series is described on its page: what [#updateWork] replaces as a whole (a `null` status means `ONGOING`).
    record WorkDescription(String title, @Nullable String synopsis, WorkType type, @Nullable WorkStatus status,
                           @Nullable String author, @Nullable Demographic demographic,
                           @Nullable String coverImageUrl, Set<String> genres, WorkFacts facts) {
    }

    /// Creates the series and the task board of the team that will translate it.
    ///
    /// @throws com.readora.domain.common.NotFoundException if `teamId` names no team
    /// @throws com.readora.domain.common.AccessDeniedDomainException if the creator does not lead that team
    /// @throws com.readora.domain.common.DomainValidationException `TEAM_REQUIRED` if no team is named (admins excepted)
    Work createWork(NewWork work, UserId creatorId);

    /// Replaces the description of a series. Allowed to the leaders of a team that translates it (has a task board
    /// for it) and to admins.
    ///
    /// @throws com.readora.domain.common.NotFoundException if the series does not exist
    /// @throws com.readora.domain.common.AccessDeniedDomainException for anyone else
    Work updateWork(WorkId workId, WorkDescription description, UserId editorId);
}
