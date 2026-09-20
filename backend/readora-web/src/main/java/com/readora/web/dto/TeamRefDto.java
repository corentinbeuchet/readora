package com.readora.web.dto;

import com.readora.domain.scanlation.TeamCredit;

import java.util.UUID;

/// The team credited for a chapter: enough to name it and link to its page.
public record TeamRefDto(UUID id, String name) {
    public static TeamRefDto fromDomain(TeamCredit team) {
        return new TeamRefDto(team.id().value(), team.name());
    }
}
