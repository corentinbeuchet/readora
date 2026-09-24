package com.readora.application.port.in;

import com.readora.application.port.in.BrowseCatalogUseCase.CatalogQuery;
import com.readora.domain.common.UserId;
import com.readora.domain.scanlation.TeamCredit;
import com.readora.domain.work.ChapterId;
import com.readora.domain.work.ChapterNumber;
import com.readora.domain.work.Work;
import org.jspecify.annotations.Nullable;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

/// "Latest updates", rankings and "Surprise me" (US-08).
public interface DiscoverUseCase {
    int RELEASES_PER_PAGE = 30;
    int RANKING_SIZE = 50;
    /// Top rated only lists series with at least this many ratings.
    int MIN_RATINGS_FOR_TOP = 5;

    enum Period { TODAY, WEEK, MONTH, ALL }

    /// @param team the team that translated the chapter
    /// @param read whether the viewer has finished this chapter (always false for guests)
    record Release(Work work, TeamCredit team, ChapterId chapterId, ChapterNumber chapterNumber, String chapterTitle, Instant publishedAt, boolean read) {
    }

    /// @param score popularity score, or average rating for top rated
    /// @param ratings number of ratings (top rated only, 0 otherwise)
    record RankedWork(int rank, Work work, double score, long ratings) {
    }

    /// @param viewer the signed-in reader, if any (read marks)
    /// @param onlyMine only the viewer's library and followed teams; needs a viewer
    @ReadOnly
    List<Release> latest(@Nullable UserId viewer, boolean onlyMine, int page);

    @ReadOnly
    List<RankedWork> popular(Period period);

    @ReadOnly
    List<RankedWork> topRated();

    @ReadOnly
    Optional<Work> surprise(CatalogQuery query);
}
