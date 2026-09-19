package com.readora.infrastructure.persistence.adapter;

import com.readora.application.port.out.NotificationRepositoryPort;
import com.readora.domain.common.UserId;
import com.readora.domain.notification.Notification;
import com.readora.domain.notification.NotificationType;
import com.readora.infrastructure.persistence.entity.NotificationJpaEntity;
import com.readora.infrastructure.persistence.repository.SpringDataNotificationRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

@Component
public class NotificationRepositoryAdapter implements NotificationRepositoryPort {

    private final SpringDataNotificationRepository springDataRepository;

    public NotificationRepositoryAdapter(SpringDataNotificationRepository springDataRepository) {
        this.springDataRepository = springDataRepository;
    }

    @Override
    @Transactional
    public void saveAll(List<Notification> notifications) {
        springDataRepository.saveAll(notifications.stream()
                .map(n -> new NotificationJpaEntity(n.id(), n.userId().value(), n.type().name(), n.message(), n.link(), n.createdAt(), n.readAt()))
                .toList());
    }

    @Override
    @Transactional(readOnly = true)
    public List<Notification> findRecent(UserId userId, int limit) {
        return springDataRepository.findByUserIdOrderByCreatedAtDesc(userId.value(), PageRequest.of(0, limit)).stream()
                .map(row -> new Notification(row.getId(), UserId.of(row.getUserId()), NotificationType.valueOf(row.getType()), row.getMessage(),
                        row.getLink(), row.getCreatedAt(), row.getReadAt()))
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public long countUnread(UserId userId) {
        return springDataRepository.countByUserIdAndReadAtIsNull(userId.value());
    }

    @Override
    @Transactional
    public void markAllRead(UserId userId, Instant at) {
        springDataRepository.markAllRead(userId.value(), at);
    }
}
