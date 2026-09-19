package com.readora.acceptance.fakes;

import com.readora.application.port.out.LibraryRepositoryPort;
import com.readora.domain.common.UserId;
import com.readora.domain.library.LibraryEntry;
import com.readora.domain.social.ReadingStatus;
import com.readora.domain.work.WorkId;
import org.jspecify.annotations.Nullable;

import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

public class InMemoryLibraryRepository implements LibraryRepositoryPort {

    private final Map<String, LibraryEntry> entries = new ConcurrentHashMap<>();

    @Override
    public Optional<LibraryEntry> find(UserId userId, WorkId workId) {
        return Optional.ofNullable(entries.get(key(userId, workId))).map(InMemoryLibraryRepository::copy);
    }

    @Override
    public List<LibraryEntry> findByUser(UserId userId, @Nullable ReadingStatus status) {
        return entries.values().stream()
                .filter(e -> e.getUserId().equals(userId) && (status == null || e.getStatus() == status))
                .sorted(Comparator.comparing(LibraryEntry::getUpdatedAt).reversed())
                .map(InMemoryLibraryRepository::copy)
                .toList();
    }

    /// Stores a copy and returns another, like the JPA adapter (callers never share the stored instance).
    @Override
    public LibraryEntry save(LibraryEntry entry) {
        entries.put(key(entry.getUserId(), entry.getWorkId()), copy(entry));
        return copy(entry);
    }

    @Override
    public boolean delete(UserId userId, WorkId workId) {
        return entries.remove(key(userId, workId)) != null;
    }

    @Override
    public List<UserId> findSubscribers(WorkId workId) {
        return entries.values().stream()
                .filter(e -> e.getWorkId().equals(workId) && e.notifiesNewChapters())
                .map(LibraryEntry::getUserId)
                .toList();
    }

    private static String key(UserId userId, WorkId workId) {
        return userId.value() + "|" + workId.value();
    }

    private static LibraryEntry copy(LibraryEntry e) {
        return new LibraryEntry(e.getUserId(), e.getWorkId(), e.getStatus(), e.getAddedAt(), e.getUpdatedAt(), e.notifiesNewChapters());
    }
}
