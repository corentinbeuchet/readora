package com.readora.infrastructure.persistence.repository;

import com.readora.infrastructure.persistence.entity.TeamJpaEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface SpringDataTeamRepository extends JpaRepository<TeamJpaEntity, UUID> {

    boolean existsByNameKey(String nameKey);

    @Query("select t from TeamJpaEntity t where t.id in (select m.team.id from TeamMemberJpaEntity m where m.userId = :userId)")
    List<TeamJpaEntity> findByMember(@Param("userId") String userId);
}
