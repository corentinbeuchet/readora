package com.readora.infrastructure.persistence.repository;

import com.readora.infrastructure.persistence.entity.ChapterCommentJpaEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface SpringDataCommentRepository extends JpaRepository<ChapterCommentJpaEntity, UUID> {
    List<ChapterCommentJpaEntity> findByChapterIdAndHiddenFalseOrderByCreatedAtAsc(UUID chapterId);

    @Query("""
            select c from ChapterCommentJpaEntity c
            where c.chapterId = :chapterId and c.parentId is null and c.hidden = false and c.isSpoiler = false
            order by c.upvotes desc, c.createdAt asc
            """)
    List<ChapterCommentJpaEntity> findTop(@Param("chapterId") UUID chapterId, org.springframework.data.domain.Limit limit);

    @Query("select max(c.createdAt) from ChapterCommentJpaEntity c where c.authorId = :authorId")
    java.util.Optional<java.time.Instant> findLatestCreatedAt(@Param("authorId") String authorId);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("update ChapterCommentJpaEntity c set c.upvotes = c.upvotes + 1 where c.id = :id")
    int incrementUpvotes(@Param("id") UUID id);

    @Query("select c.upvotes from ChapterCommentJpaEntity c where c.id = :id")
    int findUpvotesById(@Param("id") UUID id);
}
