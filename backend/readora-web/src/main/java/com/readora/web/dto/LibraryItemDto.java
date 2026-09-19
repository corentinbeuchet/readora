package com.readora.web.dto;

import com.readora.application.port.in.ManageLibraryUseCase.LibraryItem;

import java.time.Instant;

/// @param newChapters chapters published since the reader last read the series
public record LibraryItemDto(WorkSummaryDto work, String status, Instant addedAt, Instant updatedAt, long newChapters,
                             boolean newChapterNotifications) {
    public static LibraryItemDto fromDomain(LibraryItem item) {
        return new LibraryItemDto(WorkSummaryDto.fromDomain(item.work()), item.entry().getStatus().name(),
                item.entry().getAddedAt(), item.entry().getUpdatedAt(), item.newChapters(), item.entry().notifiesNewChapters());
    }
}
