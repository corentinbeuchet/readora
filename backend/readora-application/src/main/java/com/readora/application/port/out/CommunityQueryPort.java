package com.readora.application.port.out;

import com.readora.domain.common.UserId;
import com.readora.domain.scanlation.ProjectId;
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

    /// @return whether this call created the follow (following twice is harmless)
    boolean follow(UserId userId, ProjectId projectId, Instant at);

    /// @return whether a follow was removed
    boolean unfollow(UserId userId, ProjectId projectId);

    boolean isFollowing(UserId userId, ProjectId projectId);

    long countFollowers(ProjectId projectId);
}
