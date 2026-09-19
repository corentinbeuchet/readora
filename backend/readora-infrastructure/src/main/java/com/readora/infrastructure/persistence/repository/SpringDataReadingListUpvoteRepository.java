package com.readora.infrastructure.persistence.repository;

import com.readora.infrastructure.persistence.entity.ReadingListUpvoteJpaEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface SpringDataReadingListUpvoteRepository extends JpaRepository<ReadingListUpvoteJpaEntity, ReadingListUpvoteJpaEntity.Key> {

    @Query("select count(v) from ReadingListUpvoteJpaEntity v where v.id.listId = :listId")
    long countByListId(@Param("listId") UUID listId);
}
