package com.readora.application.port.in;

import com.readora.domain.common.UserId;
import com.readora.domain.work.Demographic;
import com.readora.domain.work.Work;
import com.readora.domain.work.WorkStatus;
import com.readora.domain.work.WorkType;
import org.jspecify.annotations.Nullable;

import java.util.Set;

public interface ManageWorkUseCase {

    /// A work as its creator describes it; a `null` status means `ONGOING`.
    record NewWork(String title, @Nullable String synopsis, WorkType type, @Nullable WorkStatus status,
                   @Nullable String author, @Nullable Demographic demographic,
                   @Nullable String coverImageUrl, Set<String> genres) {
    }

    Work createWork(NewWork work, UserId creatorId);
}
