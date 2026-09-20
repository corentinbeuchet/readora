package com.readora.infrastructure.persistence.adapter;

import com.readora.application.port.out.DiscoveryQueryPort;
import com.readora.domain.common.UserId;
import com.readora.domain.scanlation.TeamId;
import com.readora.domain.work.ChapterId;
import com.readora.domain.work.ChapterNumber;
import com.readora.domain.work.WorkId;
import jakarta.persistence.EntityManager;
import jakarta.persistence.TypedQuery;
import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/// Feed and ranking queries. Each is one SQL statement; works are loaded by the service in one more.
@Component
public class DiscoveryQueryAdapter implements DiscoveryQueryPort {

    private static final String RELEASES = """
            select c.id, c.workId, c.teamId, c.chapterNumber, c.title, c.publishedAt from ChapterJpaEntity c
            where c.status = 'PUBLISHED' %s
            order by c.publishedAt desc, c.id
            """;
    private static final String ONLY_FOR_READER = """
            and (c.workId in (select l.id.workId from LibraryEntryJpaEntity l where l.id.userId = :userId)
                 or c.teamId in (select f.id.teamId from TeamFollowJpaEntity f where f.id.userId = :userId))
            """;

    private final EntityManager entityManager;

    public DiscoveryQueryAdapter(EntityManager entityManager) {
        this.entityManager = entityManager;
    }

    @Override
    @Transactional(readOnly = true)
    public List<ChapterRelease> findLatestReleases(@Nullable UserId onlyFor, int page, int size) {
        TypedQuery<Object[]> query = entityManager.createQuery(RELEASES.formatted(onlyFor != null ? ONLY_FOR_READER : ""), Object[].class);
        if (onlyFor != null) {
            query.setParameter("userId", onlyFor.value());
        }
        return query.setFirstResult(page * size).setMaxResults(size).getResultList().stream()
                .map(row -> new ChapterRelease(ChapterId.of((UUID) row[0]), WorkId.of((UUID) row[1]), TeamId.of((UUID) row[2]),
                        ChapterNumber.of((String) row[3]), row[4] != null ? (String) row[4] : "", (Instant) row[5]))
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public Set<ChapterId> findFinished(UserId userId, Collection<ChapterId> chapterIds) {
        if (chapterIds.isEmpty()) {
            return Set.of();
        }
        List<UUID> ids = entityManager.createQuery("""
                        select r.id.chapterId from ChapterReadJpaEntity r
                        where r.id.userId = :userId and r.finished = true and r.id.chapterId in :ids
                        """, UUID.class)
                .setParameter("userId", userId.value())
                .setParameter("ids", chapterIds.stream().map(ChapterId::value).toList())
                .getResultList();
        Set<ChapterId> finished = new HashSet<>();
        ids.forEach(id -> finished.add(ChapterId.of(id)));
        return finished;
    }

    @Override
    @Transactional(readOnly = true)
    public List<PopularWork> findPopular(Instant since, int limit) {
        List<Object[]> rows = entityManager.createQuery("""
                        select w.id,
                               (select count(r) from ChapterReadJpaEntity r where r.workId = w.id and r.readAt >= :since)
                             + 3 * (select count(c) from ChapterCommentJpaEntity c, ChapterJpaEntity ch
                                    where ch.id = c.chapterId and ch.workId = w.id and c.createdAt >= :since)
                             + 5 * (select count(l) from LibraryEntryJpaEntity l where l.id.workId = w.id and l.addedAt >= :since) as score
                        from WorkJpaEntity w
                        order by score desc, w.updatedAt desc
                        """, Object[].class)
                .setParameter("since", since)
                .setMaxResults(limit)
                .getResultList();
        return rows.stream()
                .map(row -> new PopularWork(WorkId.of((UUID) row[0]), ((Number) row[1]).longValue()))
                .filter(work -> work.score() > 0)
                .toList();
    }
}
