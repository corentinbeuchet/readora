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
    List<ChapterCommentJpaEntity> findByChapterIdOrderByCreatedAtAsc(UUID chapterId);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("update ChapterCommentJpaEntity c set c.upvotes = c.upvotes + 1 where c.id = :id")
    int incrementUpvotes(@Param("id") UUID id);

    @Query("select c.upvotes from ChapterCommentJpaEntity c where c.id = :id")
    int findUpvotesById(@Param("id") UUID id);
}
