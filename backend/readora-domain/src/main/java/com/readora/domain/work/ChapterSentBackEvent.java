package com.readora.domain.work;

import com.readora.domain.common.DomainEvent;
import com.readora.domain.scanlation.TeamId;

import java.time.Instant;

/// A moderator sent a team's first chapter back (US-11); the listener tells the team's leaders.
public record ChapterSentBackEvent(ChapterId chapterId, TeamId teamId, Instant occurredOn) implements DomainEvent {
    public static ChapterSentBackEvent now(ChapterId chapterId, TeamId teamId) {
        return new ChapterSentBackEvent(chapterId, teamId, Instant.now());
    }
}
