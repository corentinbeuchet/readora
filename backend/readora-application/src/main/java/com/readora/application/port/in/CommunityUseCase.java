package com.readora.application.port.in;

import com.readora.domain.common.UserId;
import com.readora.domain.scanlation.ScanlationRole;
import com.readora.domain.scanlation.TeamId;
import com.readora.domain.work.ChapterId;
import com.readora.domain.work.ChapterNumber;
import com.readora.domain.work.Work;
import com.readora.domain.work.WorkId;
import org.jspecify.annotations.Nullable;

import java.time.Instant;
import java.util.List;
import java.util.Set;

/// Public profiles, team pages and team follows (US-12).
public interface CommunityUseCase {
    int TOP_GENRES = 3;
    int TEAM_LATEST_CHAPTERS = 10;

    record PublicProfile(String username, String displayName, @Nullable String avatarUrl, String bio, Instant joinedAt,
                         long chaptersRead, List<String> topGenres, List<Work> completedSeries) {
    }

    record TeamMemberView(String username, Set<ScanlationRole> roles) {
    }

    /// A reader found by name, to invite them to a team.
    record ReaderRef(String username, String displayName) {
    }

    int READER_SEARCH_MIN = 2;
    int READER_SEARCH_MAX = 50;
    int READER_SEARCH_LIMIT = 8;

    /// A series the team translates, with the number of chapters the team published in it.
    record TeamSeries(Work work, long chapterCount) {
    }

    record TeamChapter(ChapterId id, WorkId workId, ChapterNumber number, String title, int pageCount, Instant publishedAt) {
    }

    /// @param series        every series the team works on, the one with the most chapters first
    /// @param latestChapters the team's latest chapters across its series, newest first
    /// @param following     whether the viewer follows the team (false for guests)
    record TeamPage(TeamId id, String name, @Nullable String description, List<TeamSeries> series, List<TeamMemberView> members,
                    List<TeamChapter> latestChapters, long followers, boolean following) {
    }

    /// @throws com.readora.domain.common.NotFoundException if there is no such reader
    PublicProfile profile(String username);

    /// @throws com.readora.domain.common.NotFoundException if there is no such team
    TeamPage team(TeamId teamId, @Nullable UserId viewer);

    /// @throws com.readora.domain.common.NotFoundException if there is no such team
    void follow(UserId userId, TeamId teamId);

    void unfollow(UserId userId, TeamId teamId);

    /// Readers whose username starts with `text`, by username (at most [#READER_SEARCH_LIMIT]).
    ///
    /// @throws com.readora.domain.common.DomainValidationException if `text` (trimmed) is shorter than
    ///         [#READER_SEARCH_MIN] or longer than [#READER_SEARCH_MAX] characters
    List<ReaderRef> findReaders(String text);
}
