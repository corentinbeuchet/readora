package com.readora.infrastructure.persistence.entity;

import jakarta.persistence.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "notifications")
public class NotificationJpaEntity {

    @Id
    private UUID id;

    @Column(name = "user_id", nullable = false, length = 100)
    private String userId;

    @Column(nullable = false, length = 30)
    private String type;

    @Column(nullable = false, length = 300)
    private String message;

    @Column(nullable = false, length = 300)
    private String link;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "read_at")
    private Instant readAt;

    protected NotificationJpaEntity() {
    }

    public NotificationJpaEntity(UUID id, String userId, String type, String message, String link, Instant createdAt, Instant readAt) {
        this.id = id;
        this.userId = userId;
        this.type = type;
        this.message = message;
        this.link = link;
        this.createdAt = createdAt;
        this.readAt = readAt;
    }

    public UUID getId() { return id; }
    public String getUserId() { return userId; }
    public String getType() { return type; }
    public String getMessage() { return message; }
    public String getLink() { return link; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getReadAt() { return readAt; }
}
