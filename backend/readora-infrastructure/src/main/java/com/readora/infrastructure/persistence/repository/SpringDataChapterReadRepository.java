package com.readora.infrastructure.persistence.repository;

import com.readora.infrastructure.persistence.entity.ChapterReadJpaEntity;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

@Repository
public interface SpringDataChapterReadRepository extends JpaRepository<ChapterReadJpaEntity, ChapterReadJpaEntity.Key> {

    List<ChapterReadJpaEntity> findByIdUserIdAndWorkId(String userId, UUID workId);

    /// The latest read of each work: no other read of the same work by this user is more recent.
    @Query("""
            select r from ChapterReadJpaEntity r
            where r.id.userId = :userId
              and not exists (select 1 from ChapterReadJpaEntity newer
                              where newer.id.userId = r.id.userId and newer.workId = r.workId
                                and (newer.readAt > r.readAt or (newer.readAt = r.readAt and newer.id.chapterId > r.id.chapterId)))
            order by r.readAt desc
            """)
    List<ChapterReadJpaEntity> findLatestPerWork(@Param("userId") String userId, Pageable page);

    /// Rows of `[workId, count]`: chapters published after the user's last read of each work.
    @Query("""
            select c.workId, count(c) from ChapterJpaEntity c
            where c.status = 'PUBLISHED' and c.workId in :workIds
              and c.publishedAt > (select max(r.readAt) from ChapterReadJpaEntity r
                                   where r.id.userId = :userId and r.workId = c.workId)
            group by c.workId
            """)
    List<Object[]> countPublishedSinceLastRead(@Param("userId") String userId, @Param("workIds") Collection<UUID> workIds);
}
