package com.readora.infrastructure.persistence.adapter;

import com.readora.application.port.out.CommunityQueryPort;
import com.readora.domain.common.UserId;
import com.readora.domain.scanlation.ProjectId;
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
        long chaptersRead = entityManager.createQuery(
                        "select count(r) from ChapterReadJpaEntity r where r.id.userId = :userId and r.finished = true", Long.class)
                .setParameter("userId", userId.value())
                .getSingleResult();
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
    public Map<ProjectId, Long> countPublishedChapters(Collection<ProjectId> projectIds) {
        if (projectIds.isEmpty()) {
            return Map.of();
        }
        Map<ProjectId, Long> counts = new HashMap<>();
        entityManager.createQuery("""
                        select c.scanlationProjectId, count(c) from ChapterJpaEntity c
                        where c.status = :status and c.scanlationProjectId in :ids group by c.scanlationProjectId
                        """, Object[].class)
                .setParameter("status", ChapterStatus.PUBLISHED.name())
                .setParameter("ids", projectIds.stream().map(ProjectId::value).toList())
                .getResultList()
                .forEach(row -> counts.put(ProjectId.of((UUID) row[0]), (Long) row[1]));
        return counts;
    }

    @Override
    @Transactional(readOnly = true)
    public List<PublishedChapter> latestPublishedChapters(Collection<ProjectId> projectIds, int limit) {
        if (projectIds.isEmpty()) {
            return List.of();
        }
        return entityManager.createQuery("""
                        select c.id, c.workId, c.chapterNumber, c.title, size(c.pages), c.publishedAt from ChapterJpaEntity c
                        where c.status = :status and c.scanlationProjectId in :ids
                        order by c.publishedAt desc, c.id
                        """, Object[].class)
                .setParameter("status", ChapterStatus.PUBLISHED.name())
                .setParameter("ids", projectIds.stream().map(ProjectId::value).toList())
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
