package com.readora.web.dto;

import com.readora.domain.social.Bookmark;
import org.jspecify.annotations.Nullable;

import java.time.Instant;
import java.util.UUID;

public record BookmarkDto(
        UUID workId,
        @Nullable UUID lastReadChapterId,
        int lastReadPageIndex,
        String status,
        Instant updatedAt
) {
    public static BookmarkDto fromDomain(Bookmark bookmark) {
        return new BookmarkDto(
                bookmark.getWorkId().value(),
                bookmark.getLastReadChapterId() != null ? bookmark.getLastReadChapterId().value() : null,
                bookmark.getLastReadPageIndex(),
                bookmark.getStatus().name(),
                bookmark.getUpdatedAt()
        );
    }
}
