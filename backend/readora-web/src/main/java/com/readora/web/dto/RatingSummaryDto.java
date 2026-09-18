package com.readora.web.dto;

import com.readora.application.port.in.RateWorkUseCase.RatingSummary;

/// @param average rounded to one decimal, `0` without ratings
public record RatingSummaryDto(double average, long count) {
    public static RatingSummaryDto fromDomain(RatingSummary summary) {
        return new RatingSummaryDto(Math.round(summary.average() * 10) / 10.0, summary.count());
    }
}
