package com.readora.web.dto;

import com.readora.application.port.in.CommunityUseCase.PublicProfile;
import org.jspecify.annotations.Nullable;

import java.time.Instant;
import java.util.List;

public record PublicProfileDto(String username, String displayName, @Nullable String avatarUrl, String bio, Instant joinedAt,
                               long chaptersRead, List<String> favouriteGenres, List<WorkSummaryDto> completedSeries) {
    public static PublicProfileDto fromDomain(PublicProfile profile) {
        return new PublicProfileDto(profile.username(), profile.displayName(), profile.avatarUrl(), profile.bio(), profile.joinedAt(),
                profile.chaptersRead(), profile.topGenres(), profile.completedSeries().stream().map(WorkSummaryDto::fromDomain).toList());
    }
}
