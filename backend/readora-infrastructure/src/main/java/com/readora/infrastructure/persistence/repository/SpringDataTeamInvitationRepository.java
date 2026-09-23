package com.readora.infrastructure.persistence.repository;

import com.readora.infrastructure.persistence.entity.TeamInvitationJpaEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface SpringDataTeamInvitationRepository extends JpaRepository<TeamInvitationJpaEntity, UUID> {
    List<TeamInvitationJpaEntity> findByTeamIdAndStatusOrderByCreatedAtAsc(UUID teamId, String status);

    List<TeamInvitationJpaEntity> findByInviteeIdAndStatusOrderByCreatedAtDesc(String inviteeId, String status);

    Optional<TeamInvitationJpaEntity> findFirstByTeamIdAndInviteeIdAndStatus(UUID teamId, String inviteeId, String status);
}
