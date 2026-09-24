package com.readora.application.port.in;

import com.readora.domain.common.UserId;
import com.readora.domain.library.LibraryEntry;
import com.readora.domain.social.ReadingStatus;
import com.readora.domain.work.Work;
import com.readora.domain.work.WorkId;
import org.jspecify.annotations.Nullable;

import java.util.List;
import java.util.Optional;

/// A reader's personal library (US-05): free for every signed-in reader.
public interface ManageLibraryUseCase {

    /// @param newChapters chapters published since the reader last read this series (US-07 badge)
    record LibraryItem(Work work, LibraryEntry entry, long newChapters) {
    }

    /// Adds the series, or changes its status if it is already there. A `null` status means `READING` for a new
    /// entry and "unchanged" for an existing one.
    ///
    /// @throws com.readora.domain.common.NotFoundException if the work doesn't exist
    LibraryEntry save(UserId userId, WorkId workId, @Nullable ReadingStatus status);

    @ReadOnly
    Optional<LibraryEntry> find(UserId userId, WorkId workId);

    /// @throws com.readora.domain.common.NotFoundException if the series is not in the reader's library
    void remove(UserId userId, WorkId workId);

    /// The reader's library, most recently updated first; a `null` status lists everything.
    @ReadOnly
    List<LibraryItem> list(UserId userId, @Nullable ReadingStatus status);

    /// @param lastChapterRead number of the last chapter opened in the series, `null` if none
    record ExportRow(String title, ReadingStatus status, @Nullable String lastChapterRead) {
    }

    /// My whole library with the last chapter read in each series (US-12 export).
    @ReadOnly
    List<ExportRow> export(UserId userId);
}
