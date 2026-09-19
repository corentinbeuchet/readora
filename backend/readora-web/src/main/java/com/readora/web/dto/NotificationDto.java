package com.readora.web.dto;

import com.readora.domain.notification.Notification;

import java.time.Instant;
import java.util.UUID;

public record NotificationDto(UUID id, String type, String message, String link, Instant createdAt, boolean read) {
    public static NotificationDto fromDomain(Notification notification) {
        return new NotificationDto(notification.id(), notification.type().name(), notification.message(), notification.link(),
                notification.createdAt(), notification.isRead());
    }
}
