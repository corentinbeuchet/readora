package com.readora.domain.notification;

import com.readora.domain.common.DomainValidationException;
import com.readora.domain.common.UserId;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class NotificationTest {

    private static final Instant NOW = Instant.parse("2026-09-10T10:00:00Z");

    @Test
    @DisplayName("Links stay inside the app; long messages are shortened")
    void linksAndMessages() {
        assertThatThrownBy(() -> Notification.create(UserId.of("k"), NotificationType.NEW_CHAPTER, "m", "https://evil.test", NOW))
                .isInstanceOf(DomainValidationException.class);
        assertThatThrownBy(() -> Notification.create(UserId.of("k"), NotificationType.NEW_CHAPTER, "m", "//evil.test", NOW))
                .isInstanceOf(DomainValidationException.class);

        Notification long_ = Notification.create(UserId.of("k"), NotificationType.NEW_CHAPTER, "x".repeat(400), "/read/1", NOW);
        assertThat(long_.message()).hasSize(Notification.MAX_MESSAGE);
        assertThat(long_.isRead()).isFalse();
    }
}
