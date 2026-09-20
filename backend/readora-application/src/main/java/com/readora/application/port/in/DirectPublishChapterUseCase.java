package com.readora.application.port.in;

import com.readora.domain.work.Chapter;
import com.readora.domain.work.PageAsset;
import com.readora.domain.common.UserId;
import com.readora.domain.scanlation.TeamId;
import com.readora.domain.work.WorkId;

import java.util.List;

public interface DirectPublishChapterUseCase {

    /// Publishes a chapter as `teamId`'s version of it.
    ///
    /// @throws com.readora.domain.common.NotFoundException if the series or the team doesn't exist
    /// @throws com.readora.domain.common.DomainValidationException `TEAM_NOT_ON_SERIES` if the team has no task board
    ///         for the series (a leader adds the series to the team first)
    /// @throws com.readora.domain.common.AccessDeniedDomainException unless the publisher is a leader or quality checker
    ///         of that team (or an admin): the global `CHAPTER_PUBLISH` permission is not enough
    Chapter directPublishChapter(WorkId workId, TeamId teamId, String chapterNumber, String title, List<PageAsset> pages, UserId publisherId);
}
