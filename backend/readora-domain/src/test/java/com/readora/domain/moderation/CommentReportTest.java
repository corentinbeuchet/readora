package com.readora.domain.moderation;

import com.readora.domain.common.DomainValidationException;
import com.readora.domain.common.UserId;
import com.readora.domain.social.CommentId;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class CommentReportTest {

    private static final Instant NOW = Instant.parse("2026-09-10T10:00:00Z");

    @Test
    @DisplayName("A report closes once, as hidden or dismissed")
    void closeOnce() {
        CommentReport report = CommentReport.open(CommentId.generate(), UserId.of("kenji"), CommentReportReason.SPAM, NOW);
        assertThatThrownBy(() -> report.close(CommentReportStatus.OPEN, UserId.of("mina"), NOW)).isInstanceOf(DomainValidationException.class);

        report.close(CommentReportStatus.DISMISSED, UserId.of("mina"), NOW);
        assertThat(report.isOpen()).isFalse();
        assertThat(report.getClosedBy()).isEqualTo(UserId.of("mina"));
        assertThatThrownBy(() -> report.close(CommentReportStatus.HIDDEN, UserId.of("mina"), NOW)).isInstanceOf(DomainValidationException.class);
    }
}
