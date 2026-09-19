package com.readora.domain.list;

import com.readora.domain.common.DomainValidationException;
import com.readora.domain.common.UserId;
import com.readora.domain.work.WorkId;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

/// A reader's list of series ("Peak Webtoons"), private until published. Only the owner changes it.
public class ReadingList {
    public static final int MAX_TITLE = 100;
    public static final int MAX_DESCRIPTION = 500;
    public static final int MAX_ITEMS = 100;

    private final UUID id;
    private final UserId ownerId;
    private final String ownerUsername;
    private String title;
    private String description;
    private boolean published;
    private final List<ListItem> items = new ArrayList<>();
    private final Instant createdAt;
    private Instant updatedAt;

    public ReadingList(UUID id, UserId ownerId, String ownerUsername, String title, String description, boolean published,
                       List<ListItem> items, Instant createdAt, Instant updatedAt) {
        this.id = Objects.requireNonNull(id, "id cannot be null");
        this.ownerId = Objects.requireNonNull(ownerId, "Owner cannot be null");
        this.ownerUsername = Objects.requireNonNull(ownerUsername, "Owner username cannot be null");
        this.title = validTitle(title);
        this.description = validDescription(description);
        this.published = published;
        replaceItems(items);
        this.createdAt = Objects.requireNonNull(createdAt, "createdAt cannot be null");
        this.updatedAt = Objects.requireNonNull(updatedAt, "updatedAt cannot be null");
    }

    public static ReadingList create(UserId ownerId, String ownerUsername, String title, String description, List<ListItem> items,
                                     boolean published, Instant now) {
        return new ReadingList(UUID.randomUUID(), ownerId, ownerUsername, title, description, published, items, now, now);
    }

    /// Replaces title, description, series and visibility.
    public void edit(String newTitle, String newDescription, List<ListItem> newItems, boolean publish, Instant now) {
        this.title = validTitle(newTitle);
        this.description = validDescription(newDescription);
        replaceItems(newItems);
        this.published = publish;
        this.updatedAt = now;
    }

    /// Adds a series at the end, or updates its note if it is already in the list.
    public void add(ListItem item, Instant now) {
        List<ListItem> next = new ArrayList<>(items);
        next.removeIf(existing -> existing.workId().equals(item.workId()));
        next.add(item);
        replaceItems(next);
        this.updatedAt = now;
    }

    public boolean isOwnedBy(UserId userId) {
        return ownerId.equals(userId);
    }

    private void replaceItems(List<ListItem> newItems) {
        Objects.requireNonNull(newItems, "Items cannot be null");
        if (newItems.size() > MAX_ITEMS) {
            throw new DomainValidationException("A list holds at most " + MAX_ITEMS + " series");
        }
        var seen = new HashSet<WorkId>();
        for (ListItem item : newItems) {
            if (!seen.add(item.workId())) {
                throw new DomainValidationException("A series appears only once in a list");
            }
        }
        items.clear();
        items.addAll(newItems);
    }

    private static String validTitle(String title) {
        if (title == null || title.isBlank()) {
            throw new DomainValidationException("A list needs a title");
        }
        String trimmed = title.trim();
        if (trimmed.length() > MAX_TITLE) {
            throw new DomainValidationException("A list title cannot exceed " + MAX_TITLE + " characters");
        }
        return trimmed;
    }

    private static String validDescription(String description) {
        String trimmed = description == null ? "" : description.trim();
        if (trimmed.length() > MAX_DESCRIPTION) {
            throw new DomainValidationException("A list description cannot exceed " + MAX_DESCRIPTION + " characters");
        }
        return trimmed;
    }

    public UUID getId() { return id; }
    public UserId getOwnerId() { return ownerId; }
    public String getOwnerUsername() { return ownerUsername; }
    public String getTitle() { return title; }
    public String getDescription() { return description; }
    public boolean isPublished() { return published; }
    public List<ListItem> getItems() { return List.copyOf(items); }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
