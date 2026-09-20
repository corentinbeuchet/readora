package com.readora.web.dto;

import com.readora.domain.work.WorkFacts;
import org.jspecify.annotations.Nullable;

import java.util.List;
import java.util.Optional;

/// The facts of a series as its page shows them; a `null` (or no title) is a fact nobody filled in.
public record WorkFactsDto(List<String> alternativeTitles, @Nullable String artist, @Nullable Integer releaseYear,
                           @Nullable String originalLanguage, @Nullable String contentRating) {

    public static WorkFactsDto fromDomain(WorkFacts facts) {
        return new WorkFactsDto(
                facts.alternativeTitles(),
                facts.artist(),
                facts.releaseYear(),
                Optional.ofNullable(facts.originalLanguage()).map(Enum::name).orElse(null),
                Optional.ofNullable(facts.contentRating()).map(Enum::name).orElse(null));
    }
}
