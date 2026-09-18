package com.readora.infrastructure.persistence.repository;

import com.readora.infrastructure.persistence.entity.RefreshTokenJpaEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface SpringDataRefreshTokenRepository extends JpaRepository<RefreshTokenJpaEntity, UUID> {
    Optional<RefreshTokenJpaEntity> findByTokenHash(String tokenHash);

    @Modifying
    @Query("update RefreshTokenJpaEntity t set t.revokedAt = :now where t.userId = :userId and t.revokedAt is null")
    int revokeAllForUser(@Param("userId") String userId, @Param("now") Instant now);

    @Modifying
    @Query("update RefreshTokenJpaEntity t set t.revokedAt = :now where t.tokenHash = :tokenHash and t.revokedAt is null")
    int revokeIfActive(@Param("tokenHash") String tokenHash, @Param("now") Instant now);

    @Modifying
    @Query("delete from RefreshTokenJpaEntity t where t.expiresAt < :threshold")
    int deleteExpiredBefore(@Param("threshold") Instant threshold);
}
