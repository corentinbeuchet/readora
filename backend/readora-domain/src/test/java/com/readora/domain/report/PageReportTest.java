package com.readora.domain.report;

import com.readora.domain.common.DomainValidationException;
import com.readora.domain.common.UserId;
import com.readora.domain.scanlation.TeamId;
import com.readora.domain.work.ChapterId;
import com.readora.domain.work.ChapterNumber;
import com.readora.domain.work.WorkId;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class PageReportTest {

    private static final Instant NOW = Instant.parse("2026-09-10T10:00:00Z");

    private PageReport open(int page) {
        return PageReport.open(ChapterId.generate(), WorkId.generate(), TeamId.generate(), ChapterNumber.of("1"), page,
                PageReportReason.IMAGE_CORRUPTED, UserId.of("kenji"), NOW);
    }

    @Test
    @DisplayName("A new report is open")
    void newReportIsOpen() {
        PageReport report = open(7);

        assertThat(report.isOpen()).isTrue();
    }

    @Test
    @DisplayName("A report is fixed once; fixing it again is refused")
    void resolveOnce() {
        PageReport report = open(7);
        report.resolve(UserId.of("leader"), NOW.plusSeconds(60));

        assertThat(report.getStatus()).isEqualTo(PageReportStatus.RESOLVED);
        assertThat(report.getResolvedBy()).isEqualTo(UserId.of("leader"));
        assertThatThrownBy(() -> report.resolve(UserId.of("leader"), NOW)).isInstanceOf(DomainValidationException.class);
    }

    @Test
    @DisplayName("Page numbers start at 1")
    void pageNumberStartsAtOne() {
        assertThatThrownBy(() -> open(0)).isInstanceOf(DomainValidationException.class);
    }
}
