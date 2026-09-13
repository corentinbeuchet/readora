package com.readora.application.port.out;

import com.readora.domain.scanlation.ProjectId;
import com.readora.domain.scanlation.ScanlationProject;
import java.util.Optional;

public interface ScanlationProjectRepositoryPort {
    Optional<ScanlationProject> findById(ProjectId id);
    ScanlationProject save(ScanlationProject project);
}
