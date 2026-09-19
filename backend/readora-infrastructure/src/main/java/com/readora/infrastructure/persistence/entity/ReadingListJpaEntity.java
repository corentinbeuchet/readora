package com.readora.infrastructure.persistence.entity;

import jakarta.persistence.*;
import org.hibernate.annotations.BatchSize;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "reading_lists")
public class ReadingListJpaEntity {

    @Id
    private UUID id;

    @Column(name = "owner_id", nullable = false, length = 100)
    private String ownerId;

    @Column(name = "owner_username", nullable = false, length = 50)
    private String ownerUsername;

    @Column(nullable = false, length = 100)
    private String title;

    @Column(nullable = false, length = 500)
    private String description;

    @Column(nullable = false)
    private boolean published;

    @ElementCollection(fetch = FetchType.LAZY)
    @BatchSize(size = 64)
    @CollectionTable(name = "reading_list_items", joinColumns = @JoinColumn(name = "list_id"))
    @OrderColumn(name = "position")
    private List<Item> items = new ArrayList<>();

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected ReadingListJpaEntity() {
    }

    public ReadingListJpaEntity(UUID id, String ownerId, String ownerUsername, Instant createdAt) {
        this.id = id;
        this.ownerId = ownerId;
        this.ownerUsername = ownerUsername;
        this.createdAt = createdAt;
    }

    public UUID getId() { return id; }
    public String getOwnerId() { return ownerId; }
    public String getOwnerUsername() { return ownerUsername; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public boolean isPublished() { return published; }
    public void setPublished(boolean published) { this.published = published; }
    public List<Item> getItems() { return items; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }

    @Embeddable
    public static class Item {
        @Column(name = "work_id", nullable = false)
        private UUID workId;

        @Column(length = 300)
        private String note;

        protected Item() {
        }

        public Item(UUID workId, String note) {
            this.workId = workId;
            this.note = note;
        }

        public UUID getWorkId() { return workId; }
        public String getNote() { return note; }
    }
}
