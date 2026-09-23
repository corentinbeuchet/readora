package com.readora.application.port.out;

import com.readora.domain.scanlation.ProjectId;
import com.readora.domain.scanlation.ScanlationProject;
import com.readora.domain.scanlation.TeamId;
import com.readora.domain.work.WorkId;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface ScanlationProjectRepositoryPort {
    Optional<ScanlationProject> findById(ProjectId id);
    List<ScanlationProject> findByWorkId(WorkId workId);
    List<ScanlationProject> findByTeamId(TeamId teamId);

    /// Every project of these teams (`GET /teams/mine` lists the boards of all my teams). Derived from
    /// [#findByTeamId(TeamId)]; the JPA adapter answers it with one query instead of one per team.
    default List<ScanlationProject> findByTeamIds(Collection<TeamId> teamIds) {
        return teamIds.stream().flatMap(teamId -> findByTeamId(teamId).stream()).toList();
    }
    ScanlationProject save(ScanlationProject project);
}
