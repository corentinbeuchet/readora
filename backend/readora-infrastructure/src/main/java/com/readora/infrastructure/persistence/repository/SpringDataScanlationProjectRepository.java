package com.readora.infrastructure.persistence.repository;

import com.readora.infrastructure.persistence.entity.ScanlationProjectJpaEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface SpringDataScanlationProjectRepository extends JpaRepository<ScanlationProjectJpaEntity, UUID> {
    List<ScanlationProjectJpaEntity> findByWorkId(UUID workId);

    List<ScanlationProjectJpaEntity> findByTeamId(UUID teamId);
}
