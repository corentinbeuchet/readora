package com.readora.application.port.in;

import com.readora.domain.common.UserId;
import com.readora.domain.scanlation.TeamId;
import com.readora.domain.work.Demographic;
import com.readora.domain.work.Work;
import com.readora.domain.work.WorkStatus;
import com.readora.domain.work.WorkType;
import org.jspecify.annotations.Nullable;

import java.util.Set;

public interface ManageWorkUseCase {

    /// A work as its creator describes it; a `null` status means `ONGOING`.
    ///
    /// @param teamId the creator's team that will translate the series; `null` gives the series a new team of its own
    ///               ("<title> Workspace") led by the creator
    record NewWork(String title, @Nullable String synopsis, WorkType type, @Nullable WorkStatus status,
                   @Nullable String author, @Nullable Demographic demographic,
                   @Nullable String coverImageUrl, Set<String> genres, @Nullable TeamId teamId) {

        public NewWork(String title, @Nullable String synopsis, WorkType type, @Nullable WorkStatus status, @Nullable String author,
                       @Nullable Demographic demographic, @Nullable String coverImageUrl, Set<String> genres) {
            this(title, synopsis, type, status, author, demographic, coverImageUrl, genres, null);
        }
    }

    /// Creates the series and the task board of the team that will translate it.
    ///
    /// @throws com.readora.domain.common.NotFoundException if `teamId` names no team
    /// @throws com.readora.domain.common.AccessDeniedDomainException if the creator does not lead that team
    Work createWork(NewWork work, UserId creatorId);
}
