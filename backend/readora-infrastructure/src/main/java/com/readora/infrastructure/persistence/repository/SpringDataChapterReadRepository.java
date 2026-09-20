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

    /// Rows of `[workId, count]`: chapter numbers that are new since the user's last read of each work. A number counts
    /// once whatever its versions, only when its first version came out after that read, and not when the user has
    /// finished a version of it.
    @Query("""
            select c.workId, count(distinct c.chapterNumber) from ChapterJpaEntity c
            where c.status = 'PUBLISHED' and c.workId in :workIds
              and c.publishedAt > (select max(r.readAt) from ChapterReadJpaEntity r
                                   where r.id.userId = :userId and r.workId = c.workId)
              and not exists (select 1 from ChapterJpaEntity older
                              where older.workId = c.workId and older.chapterNumber = c.chapterNumber and older.status = 'PUBLISHED'
                                and older.publishedAt <= (select max(r2.readAt) from ChapterReadJpaEntity r2
                                                          where r2.id.userId = :userId and r2.workId = c.workId))
              and not exists (select 1 from ChapterReadJpaEntity done
                              where done.id.userId = :userId and done.workId = c.workId
                                and done.chapterNumber = c.chapterNumber and done.finished = true)
            group by c.workId
            """)
    List<Object[]> countPublishedSinceLastRead(@Param("userId") String userId, @Param("workIds") Collection<UUID> workIds);
}
