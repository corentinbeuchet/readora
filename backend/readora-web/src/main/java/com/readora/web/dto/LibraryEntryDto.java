package com.readora.web.dto;

import com.readora.domain.library.LibraryEntry;

import java.time.Instant;
import java.util.UUID;

public record LibraryEntryDto(UUID workId, String status, Instant addedAt, Instant updatedAt) {
    public static LibraryEntryDto fromDomain(LibraryEntry entry) {
        return new LibraryEntryDto(entry.getWorkId().value(), entry.getStatus().name(), entry.getAddedAt(), entry.getUpdatedAt());
    }
}
