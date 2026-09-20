package com.readora.domain.scanlation;

import java.util.Objects;

/// The team named next to a chapter it translated.
public record TeamCredit(TeamId id, String name) {
    public TeamCredit {
        Objects.requireNonNull(id, "TeamId cannot be null");
        Objects.requireNonNull(name, "Team name cannot be null");
    }

    public static TeamCredit of(Team team) {
        return new TeamCredit(team.getId(), team.getName());
    }
}
