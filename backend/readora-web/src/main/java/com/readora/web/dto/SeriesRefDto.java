package com.readora.web.dto;

import com.readora.domain.work.Work;

import java.util.UUID;

/// A series named in a list that only links to it (a team's task boards): no cover, genres or facts.
public record SeriesRefDto(UUID id, String title) {
    public static SeriesRefDto fromDomain(Work work) {
        return new SeriesRefDto(work.getId().value(), work.getTitle());
    }
}
