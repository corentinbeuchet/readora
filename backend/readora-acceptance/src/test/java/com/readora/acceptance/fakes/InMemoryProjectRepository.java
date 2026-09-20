package com.readora.acceptance.fakes;

import com.readora.application.port.out.ScanlationProjectRepositoryPort;
import com.readora.domain.scanlation.ProjectId;
import com.readora.domain.scanlation.ScanlationProject;
import com.readora.domain.scanlation.TeamId;
import com.readora.domain.work.WorkId;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

public class InMemoryProjectRepository implements ScanlationProjectRepositoryPort {

    private final Map<ProjectId, ScanlationProject> projects = new ConcurrentHashMap<>();

    @Override
    public Optional<ScanlationProject> findById(ProjectId id) {
        return Optional.ofNullable(projects.get(id));
    }

    @Override
    public List<ScanlationProject> findByWorkId(WorkId workId) {
        return projects.values().stream().filter(p -> p.getWorkId().equals(workId)).toList();
    }

    @Override
    public List<ScanlationProject> findByTeamId(TeamId teamId) {
        return projects.values().stream().filter(p -> p.getTeamId().equals(teamId)).toList();
    }

    @Override
    public ScanlationProject save(ScanlationProject project) {
        projects.put(project.getId(), project);
        return project;
    }
}
