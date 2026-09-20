package com.readora.acceptance.fakes;

import com.readora.application.port.out.TeamRepositoryPort;
import com.readora.domain.common.UserId;
import com.readora.domain.scanlation.Team;
import com.readora.domain.scanlation.TeamId;

import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

public class InMemoryTeamRepository implements TeamRepositoryPort {

    private final Map<TeamId, Team> teams = new ConcurrentHashMap<>();

    /// A stored throwaway team, for scenarios that need a chapter but are not about teams.
    public TeamId anyTeam() {
        return save(Team.create("Team " + java.util.UUID.randomUUID(), null, UserId.of("any-leader"))).getId();
    }

    @Override
    public Optional<Team> findById(TeamId id) {
        return Optional.ofNullable(teams.get(id));
    }

    @Override
    public List<Team> findAllById(Collection<TeamId> ids) {
        return ids.stream().distinct().flatMap(id -> findById(id).stream()).toList();
    }

    @Override
    public List<Team> findByMember(UserId userId) {
        return teams.values().stream().filter(team -> team.findMember(userId).isPresent()).toList();
    }

    @Override
    public boolean existsByName(String name) {
        return teams.values().stream().anyMatch(team -> team.getName().equalsIgnoreCase(name));
    }

    /// Like the JPA adapter: the returned object is rebuilt from state and carries no pending events.
    @Override
    public Team save(Team team) {
        teams.put(team.getId(), team);
        return new Team(team.getId(), team.getName(), team.getDescription(), team.getMembers(), team.getCreatedAt(), team.getUpdatedAt());
    }
}
