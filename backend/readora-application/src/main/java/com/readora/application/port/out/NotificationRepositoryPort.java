package com.readora.application.port.out;

import com.readora.domain.common.UserId;
import com.readora.domain.notification.Notification;

import java.time.Instant;
import java.util.List;

public interface NotificationRepositoryPort {
    void saveAll(List<Notification> notifications);

    /// Most recent first.
    List<Notification> findRecent(UserId userId, int limit);

    long countUnread(UserId userId);

    void markAllRead(UserId userId, Instant at);
}
