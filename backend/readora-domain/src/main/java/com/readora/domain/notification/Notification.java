package com.readora.domain.notification;

import com.readora.domain.common.DomainValidationException;
import com.readora.domain.common.UserId;
import org.jspecify.annotations.Nullable;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

/// Something the reader should know about, with an in-app link (a path such as `/read/{chapterId}`).
public record Notification(UUID id, UserId userId, NotificationType type, String message, String link, Instant createdAt,
                           @Nullable Instant readAt) {
    public static final int MAX_MESSAGE = 300;
    public static final int MAX_LINK = 300;

    public Notification {
        Objects.requireNonNull(id, "id cannot be null");
        Objects.requireNonNull(userId, "UserId cannot be null");
        Objects.requireNonNull(type, "NotificationType cannot be null");
        Objects.requireNonNull(createdAt, "createdAt cannot be null");
        if (message == null || message.isBlank()) {
            throw new DomainValidationException("A notification needs a message");
        }
        message = message.length() > MAX_MESSAGE ? message.substring(0, MAX_MESSAGE - 1) + "…" : message;
        if (link == null || !link.startsWith("/") || link.startsWith("//") || link.length() > MAX_LINK) {
            throw new DomainValidationException("A notification link is an in-app path");
        }
    }

    public static Notification create(UserId userId, NotificationType type, String message, String link, Instant now) {
        return new Notification(UUID.randomUUID(), userId, type, message, link, now, null);
    }

    public boolean isRead() {
        return readAt != null;
    }
}
