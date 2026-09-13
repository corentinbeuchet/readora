package com.readora.infrastructure.persistence.repository;

import com.readora.infrastructure.persistence.entity.WorkJpaEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface SpringDataWorkRepository extends JpaRepository<WorkJpaEntity, UUID> {
}
