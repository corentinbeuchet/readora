package com.readora.acceptance.fakes;

import com.readora.application.port.out.ReadingListRepositoryPort;
import com.readora.domain.common.UserId;
import com.readora.domain.list.ReadingList;

import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

public class InMemoryReadingListRepository implements ReadingListRepositoryPort {

    private final Map<UUID, ReadingList> lists = new ConcurrentHashMap<>();
    private final Map<UUID, Set<UserId>> upvotes = new ConcurrentHashMap<>();

    @Override
    public Optional<ReadingList> findById(UUID id) {
        return Optional.ofNullable(lists.get(id));
    }

    @Override
    public ReadingList save(ReadingList list) {
        lists.put(list.getId(), list);
        return list;
    }

    @Override
    public List<ReadingList> findByOwner(UserId ownerId) {
        return lists.values().stream().filter(l -> l.isOwnedBy(ownerId)).toList();
    }

    @Override
    public List<ReadingList> findTopPublished(int limit) {
        return lists.values().stream().filter(ReadingList::isPublished)
                .sorted(Comparator.comparingInt((ReadingList l) -> upvotes.getOrDefault(l.getId(), Set.of()).size()).reversed())
                .limit(limit).toList();
    }

    @Override
    public long addUpvote(UUID listId, UserId userId) {
        upvotes.computeIfAbsent(listId, id -> ConcurrentHashMap.newKeySet()).add(userId);
        return upvotes.get(listId).size();
    }

    @Override
    public Map<UUID, Long> countUpvotes(Collection<UUID> listIds) {
        Map<UUID, Long> counts = new HashMap<>();
        listIds.forEach(id -> counts.put(id, (long) upvotes.getOrDefault(id, Set.of()).size()));
        return counts;
    }
}
