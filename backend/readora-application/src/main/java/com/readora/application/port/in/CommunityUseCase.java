package com.readora.application.port.in;

import com.readora.domain.common.UserId;
import com.readora.domain.scanlation.ProjectId;
import com.readora.domain.scanlation.ScanlationRole;
import com.readora.domain.work.Chapter;
import com.readora.domain.work.Work;
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

    /// @param following whether the viewer follows the team (false for guests)
    record TeamPage(ProjectId id, String name, Work series, List<TeamMemberView> members, List<Chapter> latestChapters,
                    long followers, boolean following) {
    }

    /// @throws com.readora.domain.common.NotFoundException if there is no such reader
    PublicProfile profile(String username);

    /// @throws com.readora.domain.common.NotFoundException if there is no such team
    TeamPage team(ProjectId projectId, @Nullable UserId viewer);

    /// @throws com.readora.domain.common.NotFoundException if there is no such team
    void follow(UserId userId, ProjectId projectId);

    void unfollow(UserId userId, ProjectId projectId);
}
