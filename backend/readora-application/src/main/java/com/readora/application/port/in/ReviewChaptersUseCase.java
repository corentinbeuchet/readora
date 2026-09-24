package com.readora.application.port.in;

import com.readora.domain.common.UserId;
import com.readora.domain.scanlation.TeamCredit;
import com.readora.domain.work.Chapter;
import com.readora.domain.work.ChapterId;

import java.util.List;

/// A team's first chapter waits for a moderator before readers see it (US-11).
public interface ReviewChaptersUseCase {
    int QUEUE_LIMIT = 100;

    /// A chapter waiting for review, with the series and team it is from.
    record WaitingChapter(Chapter chapter, String seriesTitle, TeamCredit team) {
    }

    /// The longest-waiting first.
    ///
    /// @throws com.readora.domain.common.AccessDeniedDomainException unless the actor can moderate
    @ReadOnly
    List<WaitingChapter> waiting(UserId actorId);

    /// Publishes the chapter; its series' readers are told.
    ///
    /// @throws com.readora.domain.common.AccessDeniedDomainException unless the actor can moderate
    /// @throws com.readora.domain.common.NotFoundException if there is no such chapter
    /// @throws com.readora.domain.common.DomainValidationException `CHAPTER_NOT_WAITING` if it is not waiting any more
    Chapter approve(UserId actorId, ChapterId chapterId);

    /// Sends the chapter back to its team as a draft to publish again; the team's leaders are told.
    ///
    /// @throws com.readora.domain.common.AccessDeniedDomainException unless the actor can moderate
    /// @throws com.readora.domain.common.NotFoundException if there is no such chapter
    /// @throws com.readora.domain.common.DomainValidationException `CHAPTER_NOT_WAITING` if it is not waiting any more
    Chapter sendBack(UserId actorId, ChapterId chapterId);
}
