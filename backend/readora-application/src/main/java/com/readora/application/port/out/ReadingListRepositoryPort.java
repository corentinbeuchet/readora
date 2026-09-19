package com.readora.application.port.out;

import com.readora.domain.common.UserId;
import com.readora.domain.list.ReadingList;

import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

public interface ReadingListRepositoryPort {
    Optional<ReadingList> findById(UUID id);

    ReadingList save(ReadingList list);

    /// The owner's lists, most recently updated first.
    List<ReadingList> findByOwner(UserId ownerId);

    /// Published lists, most upvoted first.
    List<ReadingList> findTopPublished(int limit);

    /// @return the list's upvotes after the call (one per reader)
    long addUpvote(UUID listId, UserId userId);

    Map<UUID, Long> countUpvotes(Collection<UUID> listIds);
}
