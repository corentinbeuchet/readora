package com.readora.infrastructure.persistence.adapter;

import com.readora.application.port.out.CommunityQueryPort;
import com.readora.domain.common.UserId;
import com.readora.domain.scanlation.TeamId;
import com.readora.domain.social.ReadingStatus;
import com.readora.domain.work.ChapterId;
import com.readora.domain.work.ChapterNumber;
import com.readora.domain.work.ChapterStatus;
import com.readora.domain.work.WorkId;
import com.readora.infrastructure.persistence.entity.TeamFollowJpaEntity;
import jakarta.persistence.EntityManager;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Component
public class CommunityQueryAdapter implements CommunityQueryPort {

    private final EntityManager entityManager;

    public CommunityQueryAdapter(EntityManager entityManager) {
        this.entityManager = entityManager;
    }

    @Override
    @Transactional(readOnly = true)
    public ReadingStats readingStats(UserId userId, int topGenres) {
        // Two versions of one chapter are one chapter read (US-12). Native: JPQL cannot count distinct pairs.
        long chaptersRead = ((Number) entityManager.createNativeQuery("""
                        select count(*) from (select distinct work_id, chapter_number from chapter_reads
                                              where user_id = :userId and finished = true) read_chapters
                        """)
                .setParameter("userId", userId.value())
                .getSingleResult()).longValue();
        List<String> genres = entityManager.createQuery("""
                        select g from ChapterReadJpaEntity r, WorkJpaEntity w join w.genres g
                        where r.id.userId = :userId and r.finished = true and w.id = r.workId
                        group by g order by count(r) desc, g
                        """, String.class)
                .setParameter("userId", userId.value())
                .setMaxResults(topGenres)
                .getResultList();
        List<WorkId> completed = entityManager.createQuery("""
                        select l.id.workId from LibraryEntryJpaEntity l
                        where l.id.userId = :userId and l.status = :status order by l.updatedAt desc
                        """, UUID.class)
                .setParameter("userId", userId.value())
                .setParameter("status", ReadingStatus.COMPLETED.name())
                .getResultList().stream().map(WorkId::of).toList();
        return new ReadingStats(chaptersRead, genres, completed);
    }

    @Override
    @Transactional(readOnly = true)
    public Map<UserId, String> usernames(Collection<UserId> userIds) {
        if (userIds.isEmpty()) {
            return Map.of();
        }
        Map<UserId, String> names = new HashMap<>();
        entityManager.createQuery("select u.id, u.username from UserAccountJpaEntity u where u.id in :ids", Object[].class)
                .setParameter("ids", userIds.stream().map(UserId::value).toList())
                .getResultList()
                .forEach(row -> names.put(UserId.of((String) row[0]), (String) row[1]));
        return names;
    }

    @Override
    @Transactional(readOnly = true)
    public Map<WorkId, Long> countPublishedChapters(TeamId teamId) {
        Map<WorkId, Long> counts = new HashMap<>();
        entityManager.createQuery("""
                        select c.workId, count(c) from ChapterJpaEntity c
                        where c.status = :status and c.teamId = :teamId group by c.workId
                        """, Object[].class)
                .setParameter("status", ChapterStatus.PUBLISHED.name())
                .setParameter("teamId", teamId.value())
                .getResultList()
                .forEach(row -> counts.put(WorkId.of((UUID) row[0]), (Long) row[1]));
        return counts;
    }

    @Override
    @Transactional(readOnly = true)
    public List<PublishedChapter> latestPublishedChapters(TeamId teamId, int limit) {
        return entityManager.createQuery("""
                        select c.id, c.workId, c.chapterNumber, c.title, size(c.pages), c.publishedAt from ChapterJpaEntity c
                        where c.status = :status and c.teamId = :teamId
                        order by c.publishedAt desc, c.id
                        """, Object[].class)
                .setParameter("status", ChapterStatus.PUBLISHED.name())
                .setParameter("teamId", teamId.value())
                .setMaxResults(limit)
                .getResultList().stream()
                .map(row -> new PublishedChapter(ChapterId.of((UUID) row[0]), WorkId.of((UUID) row[1]), ChapterNumber.of((String) row[2]),
                        row[3] != null ? (String) row[3] : "", ((Number) row[4]).intValue(), (Instant) row[5]))
                .toList();
    }

    @Override
    @Transactional
    public boolean follow(UserId userId, TeamId teamId, Instant at) {
        var key = new TeamFollowJpaEntity.Key(userId.value(), teamId.value());
        if (entityManager.find(TeamFollowJpaEntity.class, key) != null) {
            return false;
        }
        entityManager.persist(new TeamFollowJpaEntity(userId.value(), teamId.value(), at));
        entityManager.flush();
        return true;
    }

    @Override
    @Transactional
    public boolean unfollow(UserId userId, TeamId teamId) {
        TeamFollowJpaEntity follow = entityManager.find(TeamFollowJpaEntity.class, new TeamFollowJpaEntity.Key(userId.value(), teamId.value()));
        if (follow == null) {
            return false;
        }
        entityManager.remove(follow);
        return true;
    }

    @Override
    @Transactional(readOnly = true)
    public boolean isFollowing(UserId userId, TeamId teamId) {
        return entityManager.find(TeamFollowJpaEntity.class, new TeamFollowJpaEntity.Key(userId.value(), teamId.value())) != null;
    }

    @Override
    @Transactional(readOnly = true)
    public long countFollowers(TeamId teamId) {
        return entityManager.createQuery("select count(f) from TeamFollowJpaEntity f where f.id.teamId = :teamId", Long.class)
                .setParameter("teamId", teamId.value())
                .getSingleResult();
    }
}
