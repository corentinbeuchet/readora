package com.readora.application.port.in;

import com.readora.domain.common.UserId;
import com.readora.domain.list.ListItem;
import com.readora.domain.list.ReadingList;
import com.readora.domain.work.Work;
import com.readora.domain.work.WorkId;
import org.jspecify.annotations.Nullable;

import java.util.List;
import java.util.UUID;

/// Curated lists of series (US-05): private drafts, published lists everyone can see and upvote.
public interface ManageListsUseCase {
    int TOP_LIMIT = 50;

    record ListDraft(String title, String description, List<ListItem> items, boolean published) {
    }

    record ListView(ReadingList list, List<Work> works, long upvotes) {
    }

    /// @throws com.readora.domain.common.NotFoundException if a series doesn't exist
    ListView create(UserId ownerId, String ownerUsername, ListDraft draft);

    /// @throws com.readora.domain.common.NotFoundException if the list (or a series) doesn't exist
    /// @throws com.readora.domain.common.AccessDeniedDomainException unless the reader owns the list
    ListView update(UserId userId, UUID listId, ListDraft draft);

    /// Adds a series to one of my lists (or updates its note).
    ListView addWork(UserId userId, UUID listId, WorkId workId, @Nullable String note);

    /// A published list, or my own draft.
    ///
    /// @throws com.readora.domain.common.NotFoundException otherwise
    ListView get(@Nullable UserId viewer, UUID listId);

    List<ListView> top();

    List<ListView> mine(UserId ownerId);

    /// @return the list's upvotes
    /// @throws com.readora.domain.common.NotFoundException if the list isn't published
    /// @throws com.readora.domain.common.DomainValidationException on your own list
    long upvote(UserId userId, UUID listId);
}
