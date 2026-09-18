package com.readora.infrastructure.persistence.repository;

import com.readora.infrastructure.persistence.entity.CommentUpvoteJpaEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface SpringDataCommentUpvoteRepository extends JpaRepository<CommentUpvoteJpaEntity, CommentUpvoteJpaEntity.Key> {
}
