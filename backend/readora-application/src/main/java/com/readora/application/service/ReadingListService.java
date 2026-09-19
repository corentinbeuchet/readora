package com.readora.application.service;

import com.readora.application.port.in.ManageListsUseCase;
import com.readora.application.port.out.ReadingListRepositoryPort;
import com.readora.application.port.out.WorkRepositoryPort;
import com.readora.domain.common.AccessDeniedDomainException;
import com.readora.domain.common.DomainValidationException;
import com.readora.domain.common.ErrorCodes;
import com.readora.domain.common.NotFoundException;
import com.readora.domain.common.UserId;
import com.readora.domain.list.ListItem;
import com.readora.domain.list.ReadingList;
import com.readora.domain.work.Work;
import com.readora.domain.work.WorkId;
import org.jspecify.annotations.Nullable;

import java.time.Clock;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

public class ReadingListService implements ManageListsUseCase {

    private final ReadingListRepositoryPort lists;
    private final WorkRepositoryPort works;
    private final Clock clock;

    public ReadingListService(ReadingListRepositoryPort lists, WorkRepositoryPort works, Clock clock) {
        this.lists = Objects.requireNonNull(lists, "ReadingListRepositoryPort cannot be null");
        this.works = Objects.requireNonNull(works, "WorkRepositoryPort cannot be null");
        this.clock = Objects.requireNonNull(clock, "Clock cannot be null");
    }

    @Override
    public ListView create(UserId ownerId, String ownerUsername, ListDraft draft) {
        requireWorks(draft.items());
        ReadingList list = ReadingList.create(ownerId, ownerUsername, draft.title(), draft.description(), draft.items(), draft.published(),
                clock.instant());
        return view(lists.save(list));
    }

    @Override
    public ListView update(UserId userId, UUID listId, ListDraft draft) {
        ReadingList list = owned(userId, listId);
        requireWorks(draft.items());
        list.edit(draft.title(), draft.description(), draft.items(), draft.published(), clock.instant());
        return view(lists.save(list));
    }

    @Override
    public ListView addWork(UserId userId, UUID listId, WorkId workId, @Nullable String note) {
        ReadingList list = owned(userId, listId);
        ListItem item = new ListItem(workId, note);
        requireWorks(List.of(item));
        list.add(item, clock.instant());
        return view(lists.save(list));
    }

    @Override
    public ListView get(@Nullable UserId viewer, UUID listId) {
        return lists.findById(listId)
                .filter(list -> list.isPublished() || (viewer != null && list.isOwnedBy(viewer)))
                .map(this::view)
                .orElseThrow(() -> new NotFoundException("List", listId));
    }

    @Override
    public List<ListView> top() {
        return views(lists.findTopPublished(TOP_LIMIT));
    }

    @Override
    public List<ListView> mine(UserId ownerId) {
        return views(lists.findByOwner(ownerId));
    }

    @Override
    public long upvote(UserId userId, UUID listId) {
        ReadingList list = lists.findById(listId).filter(ReadingList::isPublished).orElseThrow(() -> new NotFoundException("List", listId));
        if (list.isOwnedBy(userId)) {
            throw DomainValidationException.withCode(ErrorCodes.OWN_CONTENT, "You cannot upvote your own list");
        }
        return lists.addUpvote(listId, userId);
    }

    private ReadingList owned(UserId userId, UUID listId) {
        ReadingList list = lists.findById(listId).orElseThrow(() -> new NotFoundException("List", listId));
        if (!list.isOwnedBy(userId)) {
            throw new AccessDeniedDomainException("Only the owner can change this list");
        }
        return list;
    }

    private void requireWorks(List<ListItem> items) {
        List<WorkId> ids = items.stream().map(ListItem::workId).toList();
        if (!ids.isEmpty() && works.findAllById(ids).size() != ids.size()) {
            throw new NotFoundException("Work", ids);
        }
    }

    private ListView view(ReadingList list) {
        return views(List.of(list)).getFirst();
    }

    /// Works and upvotes for several lists in two queries.
    private List<ListView> views(List<ReadingList> found) {
        if (found.isEmpty()) {
            return List.of();
        }
        List<WorkId> ids = found.stream().flatMap(l -> l.getItems().stream()).map(ListItem::workId).distinct().toList();
        Map<WorkId, Work> byId = ids.isEmpty() ? Map.of()
                : works.findAllById(ids).stream().collect(Collectors.toMap(Work::getId, Function.identity()));
        Map<UUID, Long> upvotes = lists.countUpvotes(found.stream().map(ReadingList::getId).toList());
        return found.stream()
                .map(list -> new ListView(list,
                        list.getItems().stream().flatMap(item -> Optional.ofNullable(byId.get(item.workId())).stream()).toList(),
                        upvotes.getOrDefault(list.getId(), 0L)))
                .toList();
    }
}
