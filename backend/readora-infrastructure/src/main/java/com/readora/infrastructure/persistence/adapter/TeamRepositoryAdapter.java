package com.readora.infrastructure.persistence.adapter;

import com.readora.application.port.out.TeamRepositoryPort;
import com.readora.domain.common.UserId;
import com.readora.domain.scanlation.ScanlationRole;
import com.readora.domain.scanlation.Team;
import com.readora.domain.scanlation.TeamId;
import com.readora.domain.scanlation.TeamMember;
import com.readora.infrastructure.persistence.entity.TeamJpaEntity;
import com.readora.infrastructure.persistence.entity.TeamMemberJpaEntity;
import com.readora.infrastructure.persistence.repository.SpringDataTeamRepository;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

@Component
public class TeamRepositoryAdapter implements TeamRepositoryPort {

    private final SpringDataTeamRepository springDataRepository;

    public TeamRepositoryAdapter(SpringDataTeamRepository springDataRepository) {
        this.springDataRepository = springDataRepository;
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<Team> findById(TeamId id) {
        return springDataRepository.findById(id.value()).map(this::toDomain);
    }

    @Override
    @Transactional(readOnly = true)
    public List<Team> findAllById(Collection<TeamId> ids) {
        if (ids.isEmpty()) {
            return List.of();
        }
        return springDataRepository.findAllById(ids.stream().map(TeamId::value).toList()).stream().map(this::toDomain).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<Team> findByMember(UserId userId) {
        return springDataRepository.findByMember(userId.value()).stream().map(this::toDomain).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public boolean existsByName(String name) {
        return springDataRepository.existsByNameKey(name.toLowerCase(Locale.ROOT));
    }

    @Override
    @Transactional
    public Team save(Team team) {
        TeamJpaEntity existing = springDataRepository.findById(team.getId().value()).orElse(null);
        if (existing == null) {
            TeamJpaEntity saved = springDataRepository.saveAndFlush(toEntity(team));
            team.restoreVersion(saved.getVersion());
            return toDomain(saved);
        }
        OptimisticLocking.verify(team, existing.getVersion(), "Team");
        existing.setDescription(team.getDescription());
        existing.setUpdatedAt(team.getUpdatedAt());

        // Update members in place
        Map<String, TeamMemberJpaEntity> existingMembersByUserId = existing.getMembers().stream()
                .collect(Collectors.toMap(TeamMemberJpaEntity::getUserId, m -> m));
        existing.getMembers().removeIf(em -> team.getMembers().stream().noneMatch(m -> m.userId().value().equals(em.getUserId())));
        for (TeamMember m : team.getMembers()) {
            TeamMemberJpaEntity memberEntity = existingMembersByUserId.get(m.userId().value());
            if (memberEntity != null) {
                memberEntity.setRoles(roleNames(m));
                memberEntity.setJoinedAt(m.joinedAt());
            } else {
                existing.getMembers().add(new TeamMemberJpaEntity(existing, m.userId().value(), roleNames(m), m.joinedAt()));
            }
        }

        TeamJpaEntity saved = OptimisticLocking.flush(team, "Team", () -> springDataRepository.saveAndFlush(existing));
        team.restoreVersion(saved.getVersion());
        return toDomain(saved);
    }

    private static List<String> roleNames(TeamMember member) {
        return new ArrayList<>(member.roles().stream().map(Enum::name).toList());
    }

    private Team toDomain(TeamJpaEntity entity) {
        return OptimisticLocking.restored(toDomainState(entity), entity.getVersion());
    }

    private Team toDomainState(TeamJpaEntity entity) {
        Set<TeamMember> members = entity.getMembers().stream()
                .map(m -> new TeamMember(
                        UserId.of(m.getUserId()),
                        m.getRoles().stream().map(ScanlationRole::valueOf).collect(Collectors.toSet()),
                        m.getJoinedAt()))
                .collect(Collectors.toSet());
        return new Team(TeamId.of(entity.getId()), entity.getName(), entity.getDescription(), members,
                entity.getCreatedAt(), entity.getUpdatedAt());
    }

    private TeamJpaEntity toEntity(Team team) {
        TeamJpaEntity entity = new TeamJpaEntity(team.getId().value(), team.getName(), team.getDescription(),
                team.getCreatedAt(), team.getUpdatedAt());
        for (TeamMember m : team.getMembers()) {
            entity.getMembers().add(new TeamMemberJpaEntity(entity, m.userId().value(), roleNames(m), m.joinedAt()));
        }
        return entity;
    }
}
