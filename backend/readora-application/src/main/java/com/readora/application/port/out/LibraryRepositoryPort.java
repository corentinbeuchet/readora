package com.readora.application.port.out;

import com.readora.domain.common.UserId;
import com.readora.domain.library.LibraryEntry;
import com.readora.domain.social.ReadingStatus;
import com.readora.domain.work.WorkId;
import org.jspecify.annotations.Nullable;

import java.util.List;
import java.util.Optional;

public interface LibraryRepositoryPort {
    Optional<LibraryEntry> find(UserId userId, WorkId workId);

    /// The reader's entries, most recently updated first; a `null` status returns every entry.
    List<LibraryEntry> findByUser(UserId userId, @Nullable ReadingStatus status);

    LibraryEntry save(LibraryEntry entry);

    /// @return whether an entry was removed
    boolean delete(UserId userId, WorkId workId);
}
