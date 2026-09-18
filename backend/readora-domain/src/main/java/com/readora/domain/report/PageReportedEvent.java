package com.readora.domain.report;

import com.readora.domain.common.DomainEvent;
import com.readora.domain.work.ChapterId;

import java.time.Instant;

public record PageReportedEvent(PageReportId reportId, ChapterId chapterId, int pageNumber, PageReportReason reason,
                                Instant occurredOn) implements DomainEvent {
    public static PageReportedEvent now(PageReportId reportId, ChapterId chapterId, int pageNumber, PageReportReason reason) {
        return new PageReportedEvent(reportId, chapterId, pageNumber, reason, Instant.now());
    }
}
