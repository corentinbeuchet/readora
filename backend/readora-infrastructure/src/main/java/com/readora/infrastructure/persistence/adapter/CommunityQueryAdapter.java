package com.readora.infrastructure.persistence.adapter;

import com.readora.application.port.out.CommunityQueryPort;
import com.readora.domain.common.UserId;
import com.readora.domain.scanlation.ProjectId;
import com.readora.domain.social.ReadingStatus;
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
    @Transactional
    public boolean follow(UserId userId, ProjectId projectId, Instant at) {
        var key = new TeamFollowJpaEntity.Key(userId.value(), projectId.value());
        if (entityManager.find(TeamFollowJpaEntity.class, key) != null) {
            return false;
        }
        entityManager.persist(new TeamFollowJpaEntity(userId.value(), projectId.value(), at));
        entityManager.flush();
        return true;
    }

    @Override
    @Transactional
    public boolean unfollow(UserId userId, ProjectId projectId) {
        TeamFollowJpaEntity follow = entityManager.find(TeamFollowJpaEntity.class, new TeamFollowJpaEntity.Key(userId.value(), projectId.value()));
        if (follow == null) {
            return false;
        }
        entityManager.remove(follow);
        return true;
    }

    @Override
    @Transactional(readOnly = true)
    public boolean isFollowing(UserId userId, ProjectId projectId) {
        return entityManager.find(TeamFollowJpaEntity.class, new TeamFollowJpaEntity.Key(userId.value(), projectId.value())) != null;
    }

    @Override
    @Transactional(readOnly = true)
    public long countFollowers(ProjectId projectId) {
        return entityManager.createQuery("select count(f) from TeamFollowJpaEntity f where f.id.projectId = :projectId", Long.class)
                .setParameter("projectId", projectId.value())
                .getSingleResult();
    }
}
