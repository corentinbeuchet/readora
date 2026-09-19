package com.readora.web.dto;

import com.readora.application.port.in.DiscoverUseCase.RankedWork;

/// @param score popularity score, or average rating (one decimal) for top rated
/// @param ratings number of ratings (top rated only)
public record RankedWorkDto(int rank, WorkSummaryDto work, double score, long ratings) {
    public static RankedWorkDto fromDomain(RankedWork ranked) {
        return new RankedWorkDto(ranked.rank(), WorkSummaryDto.fromDomain(ranked.work()), ranked.score(), ranked.ratings());
    }
}
