package com.readora.acceptance.fakes;

import com.readora.application.port.out.NotificationRepositoryPort;
import com.readora.domain.common.UserId;
import com.readora.domain.notification.Notification;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

public class InMemoryNotificationRepository implements NotificationRepositoryPort {

    private final List<Notification> notifications = new ArrayList<>();

    @Override
    public void saveAll(List<Notification> batch) {
        notifications.addAll(batch);
    }

    @Override
    public List<Notification> findRecent(UserId userId, int limit) {
        return notifications.stream()
                .filter(n -> n.userId().equals(userId))
                .sorted(Comparator.comparing(Notification::createdAt).reversed())
                .limit(limit)
                .toList();
    }

    @Override
    public long countUnread(UserId userId) {
        return notifications.stream().filter(n -> n.userId().equals(userId) && !n.isRead()).count();
    }

    @Override
    public void markAllRead(UserId userId, Instant at) {
        notifications.replaceAll(n -> n.userId().equals(userId) && !n.isRead()
                ? new Notification(n.id(), n.userId(), n.type(), n.message(), n.link(), n.createdAt(), at)
                : n);
    }
}
