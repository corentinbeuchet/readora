package com.readora.application.port.out;

import com.readora.domain.common.UserId;
import com.readora.domain.scanlation.ProjectId;
import com.readora.domain.scanlation.ScanlationProject;
import com.readora.domain.scanlation.TaskId;
import com.readora.domain.scanlation.TaskStatus;
import com.readora.domain.scanlation.TeamId;
import com.readora.domain.scanlation.WorkflowStage;
import com.readora.domain.work.ChapterNumber;
import com.readora.domain.work.WorkId;
import org.jspecify.annotations.Nullable;

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

    /// A team's board without its tasks: what lists of boards (the Studio, a team page) show.
    record BoardRef(ProjectId projectId, TeamId teamId, WorkId workId, boolean boardEnabled) {
    }

    /// The boards of these teams, without their tasks. Adapters answer it with one query of plain columns: loading the
    /// projects would load every task and every page of every board.
    default List<BoardRef> findBoardRefs(Collection<TeamId> teamIds) {
        return findByTeamIds(teamIds).stream()
                .map(project -> new BoardRef(project.getId(), project.getTeamId(), project.getWorkId(), project.isBoardEnabled()))
                .toList();
    }

    /// An unfinished task of a board that is on, without its pages: what "Waiting for you" lists.
    record OpenTask(ProjectId projectId, TeamId teamId, WorkId workId, TaskId taskId, ChapterNumber chapterNumber,
                    WorkflowStage stage, @Nullable UserId assigneeId) {
    }

    /// The unfinished tasks (not completed, not published) of these teams' boards that are on. Adapters answer it with
    /// one query of plain columns, without loading pages.
    default List<OpenTask> findOpenTasks(Collection<TeamId> teamIds) {
        return findByTeamIds(teamIds).stream()
                .filter(ScanlationProject::isBoardEnabled)
                .flatMap(project -> project.getTasks().stream()
                        .filter(task -> task.getStatus() != TaskStatus.COMPLETED && task.getStage() != WorkflowStage.PUBLISHED)
                        .map(task -> new OpenTask(project.getId(), project.getTeamId(), project.getWorkId(), task.getId(),
                                task.getChapterNumber(), task.getStage(), task.getAssigneeId())))
                .toList();
    }

    /// Whether the team has a board for the series (one query, not the team's boards).
    default boolean existsByTeamAndWork(TeamId teamId, WorkId workId) {
        return findByTeamId(teamId).stream().anyMatch(project -> project.getWorkId().equals(workId));
    }

    /// The teams that have a board for the series.
    default List<TeamId> findTeamIdsByWork(WorkId workId) {
        return findByWorkId(workId).stream().map(ScanlationProject::getTeamId).toList();
    }
}
