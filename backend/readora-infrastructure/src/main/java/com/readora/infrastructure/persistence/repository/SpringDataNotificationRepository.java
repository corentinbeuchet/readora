package com.readora.infrastructure.persistence.repository;

import com.readora.infrastructure.persistence.entity.NotificationJpaEntity;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Repository
public interface SpringDataNotificationRepository extends JpaRepository<NotificationJpaEntity, UUID> {

    List<NotificationJpaEntity> findByUserIdOrderByCreatedAtDesc(String userId, Pageable page);

    long countByUserIdAndReadAtIsNull(String userId);

    @Modifying
    @Query("update NotificationJpaEntity n set n.readAt = :at where n.userId = :userId and n.readAt is null")
    int markAllRead(@Param("userId") String userId, @Param("at") Instant at);
}
