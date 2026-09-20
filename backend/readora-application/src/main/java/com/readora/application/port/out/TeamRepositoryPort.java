package com.readora.application.port.out;

import com.readora.domain.common.UserId;
import com.readora.domain.scanlation.Team;
import com.readora.domain.scanlation.TeamId;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface TeamRepositoryPort {
    Optional<Team> findById(TeamId id);
    List<Team> findAllById(Collection<TeamId> ids);
    List<Team> findByMember(UserId userId);

    /// Whether a team already uses this name, ignoring case.
    boolean existsByName(String name);

    Team save(Team team);
}
