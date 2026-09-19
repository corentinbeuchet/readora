package com.readora.acceptance.fakes;

import com.readora.application.port.out.CommentReportRepositoryPort;
import com.readora.domain.common.UserId;
import com.readora.domain.moderation.CommentReport;
import com.readora.domain.social.CommentId;

import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

public class InMemoryCommentReportRepository implements CommentReportRepositoryPort {

    private final Map<UUID, CommentReport> reports = new ConcurrentHashMap<>();

    @Override
    public Optional<CommentReport> findById(UUID id) {
        return Optional.ofNullable(reports.get(id));
    }

    @Override
    public CommentReport save(CommentReport report) {
        reports.put(report.getId(), report);
        return report;
    }

    @Override
    public Optional<CommentReport> findOpen(UserId reporterId, CommentId commentId) {
        return reports.values().stream()
                .filter(r -> r.isOpen() && r.getReporterId().equals(reporterId) && r.getCommentId().equals(commentId))
                .findFirst();
    }

    @Override
    public List<CommentReport> findOpenByComment(CommentId commentId) {
        return reports.values().stream().filter(r -> r.isOpen() && r.getCommentId().equals(commentId)).toList();
    }

    @Override
    public List<CommentReport> findOpen(int limit) {
        return reports.values().stream().filter(CommentReport::isOpen).sorted(Comparator.comparing(CommentReport::getCreatedAt)).limit(limit).toList();
    }
}
