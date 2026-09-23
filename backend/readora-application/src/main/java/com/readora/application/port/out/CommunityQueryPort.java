package com.readora.application.port.out;

import com.readora.domain.common.UserId;
import com.readora.domain.scanlation.TeamId;
import com.readora.domain.work.ChapterId;
import com.readora.domain.work.ChapterNumber;
import com.readora.domain.work.WorkId;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Map;

/// Reading stats for public profiles, usernames, and team follows (US-12).
public interface CommunityQueryPort {

    /// @param topGenres the reader's most read genres (finished chapters), most read first
    record ReadingStats(long chaptersRead, List<String> topGenres, List<WorkId> completedSeries) {
        public ReadingStats {
            topGenres = List.copyOf(topGenres);
            completedSeries = List.copyOf(completedSeries);
        }
    }

    ReadingStats readingStats(UserId userId, int topGenres);

    /// Usernames of the given users that exist.
    Map<UserId, String> usernames(Collection<UserId> userIds);

    record ReaderName(String username, String displayName) {
    }

    /// Readers whose username starts with `prefix` (case-insensitive, taken literally), by username, at most `limit`.
    List<ReaderName> readersStartingWith(String prefix, int limit);

    /// A published chapter as a team page lists it: no pages are loaded.
    record PublishedChapter(ChapterId id, WorkId workId, ChapterNumber number, String title, int pageCount, Instant publishedAt) {
    }

    /// Number of chapters the team published in each series where it published at least one.
    Map<WorkId, Long> countPublishedChapters(TeamId teamId);

    /// The team's most recently published chapters, newest first.
    List<PublishedChapter> latestPublishedChapters(TeamId teamId, int limit);

    /// @return whether this call created the follow (following twice is harmless)
    boolean follow(UserId userId, TeamId teamId, Instant at);

    /// @return whether a follow was removed
    boolean unfollow(UserId userId, TeamId teamId);

    boolean isFollowing(UserId userId, TeamId teamId);

    long countFollowers(TeamId teamId);
}
