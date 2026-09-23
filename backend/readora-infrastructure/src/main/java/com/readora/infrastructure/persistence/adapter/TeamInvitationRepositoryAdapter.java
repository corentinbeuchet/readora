package com.readora.infrastructure.persistence.adapter;

import com.readora.application.port.out.TeamInvitationRepositoryPort;
import com.readora.domain.common.UserId;
import com.readora.domain.scanlation.InvitationStatus;
import com.readora.domain.scanlation.ScanlationRole;
import com.readora.domain.scanlation.TeamId;
import com.readora.domain.scanlation.TeamInvitation;
import com.readora.domain.scanlation.TeamInvitationId;
import com.readora.infrastructure.persistence.entity.TeamInvitationJpaEntity;
import com.readora.infrastructure.persistence.repository.SpringDataTeamInvitationRepository;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

@Component
public class TeamInvitationRepositoryAdapter implements TeamInvitationRepositoryPort {

    private final SpringDataTeamInvitationRepository springDataRepository;

    public TeamInvitationRepositoryAdapter(SpringDataTeamInvitationRepository springDataRepository) {
        this.springDataRepository = springDataRepository;
    }

    @Override
    @Transactional
    public TeamInvitation save(TeamInvitation invitation) {
        TeamInvitationJpaEntity existing = springDataRepository.findById(invitation.getId().value()).orElse(null);
        if (existing == null) {
            TeamInvitationJpaEntity saved = springDataRepository.saveAndFlush(toEntity(invitation));
            invitation.restoreVersion(saved.getVersion());
            return toDomain(saved);
        }
        OptimisticLocking.verify(invitation, existing.getVersion(), "TeamInvitation");
        existing.setStatus(invitation.getStatus().name());
        existing.setAnsweredAt(invitation.getAnsweredAt());
        TeamInvitationJpaEntity saved = OptimisticLocking.flush(invitation, "TeamInvitation", () -> springDataRepository.saveAndFlush(existing));
        invitation.restoreVersion(saved.getVersion());
        return toDomain(saved);
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<TeamInvitation> findById(TeamInvitationId id) {
        return springDataRepository.findById(id.value()).map(this::toDomain);
    }

    @Override
    @Transactional(readOnly = true)
    public List<TeamInvitation> findPendingByTeam(TeamId teamId) {
        return springDataRepository.findByTeamIdAndStatusOrderByCreatedAtAsc(teamId.value(), InvitationStatus.PENDING.name()).stream()
                .map(this::toDomain)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<TeamInvitation> findPendingByInvitee(UserId inviteeId) {
        return springDataRepository.findByInviteeIdAndStatusOrderByCreatedAtDesc(inviteeId.value(), InvitationStatus.PENDING.name()).stream()
                .map(this::toDomain)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<TeamInvitation> findPending(TeamId teamId, UserId inviteeId) {
        return springDataRepository.findFirstByTeamIdAndInviteeIdAndStatus(teamId.value(), inviteeId.value(), InvitationStatus.PENDING.name())
                .map(this::toDomain);
    }

    private TeamInvitation toDomain(TeamInvitationJpaEntity row) {
        Set<ScanlationRole> roles = Arrays.stream(row.getRoles().split(","))
                .map(String::trim)
                .filter(role -> !role.isEmpty())
                .map(ScanlationRole::valueOf)
                .collect(Collectors.toSet());
        TeamInvitation invitation = new TeamInvitation(TeamInvitationId.of(row.getId()), TeamId.of(row.getTeamId()), UserId.of(row.getInviteeId()),
                roles, UserId.of(row.getInvitedBy()), InvitationStatus.valueOf(row.getStatus()), row.getCreatedAt(), row.getAnsweredAt());
        return OptimisticLocking.restored(invitation, row.getVersion());
    }

    private TeamInvitationJpaEntity toEntity(TeamInvitation invitation) {
        String roles = invitation.getRoles().stream().map(Enum::name).sorted().collect(Collectors.joining(","));
        return new TeamInvitationJpaEntity(invitation.getId().value(), invitation.getTeamId().value(), invitation.getInviteeId().value(), roles,
                invitation.getInvitedBy().value(), invitation.getStatus().name(), invitation.getCreatedAt());
    }
}
