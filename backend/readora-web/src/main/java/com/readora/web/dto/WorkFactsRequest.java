package com.readora.web.dto;

import com.readora.domain.work.ContentRating;
import com.readora.domain.work.OriginalLanguage;
import com.readora.domain.work.WorkFacts;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;
import org.jspecify.annotations.Nullable;

import java.util.List;

/// The optional facts of a series (US-04). Sizes mirror [WorkFacts] and migration `V21`; blank texts mean "unknown".
public record WorkFactsRequest(
        @Size(max = 10, message = "A series has at most 10 other titles")
        @Nullable List<@Size(max = 255, message = "A title must not exceed 255 characters") String> alternativeTitles,

        @Size(max = 120, message = "Artist must not exceed 120 characters")
        @Nullable String artist,

        @Min(value = 1900, message = "Release year must be 1900 or later")
        @Max(value = 2100, message = "Release year must be 2100 or earlier")
        @Nullable Integer releaseYear,

        @Nullable OriginalLanguage originalLanguage,

        @Nullable ContentRating contentRating
) {
    /// A request without facts describes a series nobody knows more about.
    public static WorkFacts toDomain(@Nullable WorkFactsRequest request) {
        if (request == null) {
            return WorkFacts.none();
        }
        List<String> titles = request.alternativeTitles();
        return new WorkFacts(titles != null ? titles : List.of(), request.artist(), request.releaseYear(), request.originalLanguage(),
                request.contentRating());
    }
}
