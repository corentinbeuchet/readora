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
import org.springframework.cache.annotation.Cacheable;
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

    /// Rankings may be up to five minutes old (`spring.cache.caffeine.spec`).
    public static final String POPULAR_WORKS_CACHE = "popular-works";

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

    /// One pass per table over the activity since `since`, grouped by series (V31 indexes the time columns), instead of
    /// three counts per series: 96 s to 59 ms for "this week" on 1.5M reads. Cached for 5 minutes (`CacheConfig`): the
    /// service rounds `since` to 5-minute steps, so one window's requests share an entry.
    @Override
    @Transactional(readOnly = true)
    @Cacheable(POPULAR_WORKS_CACHE)
    public List<PopularWork> findPopular(Instant since, int limit) {
        @SuppressWarnings("unchecked")
        List<Object[]> rows = entityManager.createNativeQuery("""
                        SELECT CAST(s.work_id AS VARCHAR(36)), sum(s.score) AS score FROM (
                            SELECT r.work_id, count(*) AS score FROM chapter_reads r WHERE r.read_at >= :since GROUP BY r.work_id
                            UNION ALL
                            SELECT ch.work_id, 3 * count(*) FROM chapter_comments c JOIN chapters ch ON ch.id = c.chapter_id
                            WHERE c.created_at >= :since GROUP BY ch.work_id
                            UNION ALL
                            SELECT l.work_id, 5 * count(*) FROM library_entries l WHERE l.added_at >= :since GROUP BY l.work_id
                        ) s JOIN works w ON w.id = s.work_id
                        GROUP BY s.work_id, w.updated_at
                        ORDER BY score DESC, w.updated_at DESC
                        """)
                .setParameter("since", since)
                .setMaxResults(limit)
                .getResultList();
        return rows.stream()
                // As text: native UUIDs come back as the driver's type (bytes on H2).
                .map(row -> new PopularWork(WorkId.of(UUID.fromString((String) row[0])), ((Number) row[1]).longValue()))
                .toList();
    }
}
