package com.readora.application.port.out;

import com.readora.domain.scanlation.Team;
import com.readora.domain.scanlation.TeamId;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface TeamRepositoryPort {
    Optional<Team> findById(TeamId id);
    List<Team> findAllById(Collection<TeamId> ids);
    Team save(Team team);
}
