package com.readora.application.port.out;

import com.readora.domain.scanlation.ProjectId;
import com.readora.domain.scanlation.ScanlationProject;
import com.readora.domain.work.WorkId;
import java.util.List;
import java.util.Optional;

public interface ScanlationProjectRepositoryPort {
    Optional<ScanlationProject> findById(ProjectId id);
    List<ScanlationProject> findByWorkId(WorkId workId);
    ScanlationProject save(ScanlationProject project);
}
