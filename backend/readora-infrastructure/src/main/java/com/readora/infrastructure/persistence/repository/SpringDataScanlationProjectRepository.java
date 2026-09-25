package com.readora.infrastructure.persistence.repository;

import com.readora.infrastructure.persistence.entity.ScanlationProjectJpaEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

@Repository
public interface SpringDataScanlationProjectRepository extends JpaRepository<ScanlationProjectJpaEntity, UUID> {
    List<ScanlationProjectJpaEntity> findByWorkId(UUID workId);

    List<ScanlationProjectJpaEntity> findByTeamId(UUID teamId);

    List<ScanlationProjectJpaEntity> findByTeamIdIn(Collection<UUID> teamIds);

    /// Rows of `[id, teamId, workId, boardEnabled]`: no task is loaded.
    @Query("select p.id, p.teamId, p.workId, p.boardEnabled from ScanlationProjectJpaEntity p where p.teamId in :teamIds")
    List<Object[]> findBoardRefsByTeamIds(@Param("teamIds") Collection<UUID> teamIds);

    /// Rows of `[projectId, teamId, workId, taskId, chapterNumber, stage, assigneeId]` for unfinished tasks of boards
    /// that are on: no page is loaded.
    @Query("""
            select p.id, p.teamId, p.workId, t.id, t.chapterNumber, t.stage, t.assigneeId
            from WorkflowTaskJpaEntity t join t.project p
            where p.teamId in :teamIds and p.boardEnabled = true and t.status <> 'COMPLETED' and t.stage <> 'PUBLISHED'""")
    List<Object[]> findOpenTasksByTeamIds(@Param("teamIds") Collection<UUID> teamIds);

    boolean existsByTeamIdAndWorkId(UUID teamId, UUID workId);

    @Query("select p.teamId from ScanlationProjectJpaEntity p where p.workId = :workId")
    List<UUID> findTeamIdsByWorkId(@Param("workId") UUID workId);
}
