package com.readora.web.dto;

import com.readora.application.port.in.TrackReadingUseCase.HistoryItem;

public record HistoryItemDto(WorkSummaryDto work, ChapterReadDto lastRead) {
    public static HistoryItemDto fromDomain(HistoryItem item) {
        return new HistoryItemDto(WorkSummaryDto.fromDomain(item.work()), ChapterReadDto.fromDomain(item.lastRead()));
    }
}
