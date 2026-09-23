package com.readora.infrastructure.persistence.adapter;

import com.readora.application.port.out.ScanlationProjectRepositoryPort;
import com.readora.domain.common.UserId;
import com.readora.domain.scanlation.*;
import com.readora.domain.work.ChapterNumber;
import com.readora.domain.work.PageAsset;
import com.readora.domain.work.WorkId;
import com.readora.infrastructure.persistence.entity.ScanlationProjectJpaEntity;
import com.readora.infrastructure.persistence.entity.WorkflowTaskJpaEntity;
import com.readora.infrastructure.persistence.entity.WorkflowTaskPageJpaEntity;
import com.readora.infrastructure.persistence.repository.SpringDataScanlationProjectRepository;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

@Component
public class ScanlationProjectRepositoryAdapter implements ScanlationProjectRepositoryPort {

    private final SpringDataScanlationProjectRepository springDataRepository;

    public ScanlationProjectRepositoryAdapter(SpringDataScanlationProjectRepository springDataRepository) {
        this.springDataRepository = springDataRepository;
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<ScanlationProject> findById(ProjectId id) {
        return springDataRepository.findById(id.value()).map(this::toDomain);
    }

    @Override
    @Transactional(readOnly = true)
    public List<ScanlationProject> findByWorkId(WorkId workId) {
        return springDataRepository.findByWorkId(workId.value()).stream()
                .map(this::toDomain)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<ScanlationProject> findByTeamId(TeamId teamId) {
        return springDataRepository.findByTeamId(teamId.value()).stream()
                .map(this::toDomain)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<ScanlationProject> findByTeamIds(Collection<TeamId> teamIds) {
        if (teamIds.isEmpty()) {
            return List.of();
        }
        return springDataRepository.findByTeamIdIn(teamIds.stream().map(TeamId::value).toList()).stream()
                .map(this::toDomain)
                .toList();
    }

    @Override
    @Transactional
    public ScanlationProject save(ScanlationProject project) {
        ScanlationProjectJpaEntity existing = springDataRepository.findById(project.getId().value()).orElse(null);
        if (existing != null) {
            OptimisticLocking.verify(project, existing.getVersion(), "ScanlationProject");
            existing.setName(project.getName());
            existing.setWorkId(project.getWorkId().value());
            existing.setBoardEnabled(project.isBoardEnabled());
            existing.setUpdatedAt(project.getUpdatedAt());

            // Update tasks in place
            Map<UUID, WorkflowTaskJpaEntity> existingTasksById = existing.getTasks().stream()
                    .collect(Collectors.toMap(WorkflowTaskJpaEntity::getId, t -> t));

            existing.getTasks().removeIf(et -> project.getTasks().stream().noneMatch(t -> t.getId().value().equals(et.getId())));

            for (WorkflowTask t : project.getTasks()) {
                WorkflowTaskJpaEntity taskEntity = existingTasksById.get(t.getId().value());
                if (taskEntity != null) {
                    taskEntity.setChapterNumber(t.getChapterNumber().value());
                    taskEntity.setStage(t.getStage().name());
                    taskEntity.setStatus(t.getStatus().name());
                    taskEntity.setAssigneeId(t.getAssigneeId() != null ? t.getAssigneeId().value() : null);
                    taskEntity.setUpdatedAt(t.getUpdatedAt());
                    syncPages(t, taskEntity);
                } else {
                    existing.getTasks().add(newTaskEntity(existing, t));
                }
            }

            ScanlationProjectJpaEntity saved = OptimisticLocking.flush(project, "ScanlationProject", () -> springDataRepository.saveAndFlush(existing));
            project.restoreVersion(saved.getVersion());
            return toDomain(saved);
        } else {
            ScanlationProjectJpaEntity entity = toEntity(project);
            ScanlationProjectJpaEntity saved = springDataRepository.saveAndFlush(entity);
            project.restoreVersion(saved.getVersion());
            return toDomain(saved);
        }
    }

    private ScanlationProject toDomain(ScanlationProjectJpaEntity entity) {
        return OptimisticLocking.restored(toDomainState(entity), entity.getVersion());
    }

    private ScanlationProject toDomainState(ScanlationProjectJpaEntity entity) {
        List<WorkflowTask> tasks = entity.getTasks() != null ?
                entity.getTasks().stream()
                        .map(t -> new WorkflowTask(
                                TaskId.of(t.getId()),
                                ChapterNumber.of(t.getChapterNumber()),
                                WorkflowStage.valueOf(t.getStage()),
                                TaskStatus.valueOf(t.getStatus()),
                                t.getAssigneeId() != null ? UserId.of(t.getAssigneeId()) : null,
                                t.getPages().stream()
                                        .map(page -> new PageAsset(page.getPageNumber(), page.getStorageKey(), page.getCdnUrl(), page.getWidth(),
                                                page.getHeight(), page.getDescription(), page.getLiteCdnUrl()))
                                        .toList(),
                                t.getUpdatedAt()
                        )).toList() : List.of();

        return new ScanlationProject(
                ProjectId.of(entity.getId()),
                entity.getName(),
                WorkId.of(entity.getWorkId()),
                TeamId.of(entity.getTeamId()),
                tasks,
                entity.isBoardEnabled(),
                entity.getCreatedAt(),
                entity.getUpdatedAt()
        );
    }

    private ScanlationProjectJpaEntity toEntity(ScanlationProject project) {
        ScanlationProjectJpaEntity entity = new ScanlationProjectJpaEntity(
                project.getId().value(),
                project.getName(),
                project.getWorkId().value(),
                project.getTeamId().value(),
                project.isBoardEnabled(),
                project.getCreatedAt(),
                project.getUpdatedAt()
        );

        List<WorkflowTaskJpaEntity> taskEntities = new ArrayList<>();
        if (project.getTasks() != null) {
            for (WorkflowTask t : project.getTasks()) {
                taskEntities.add(newTaskEntity(entity, t));
            }
        }
        entity.setTasks(taskEntities);

        return entity;
    }

    private static WorkflowTaskJpaEntity newTaskEntity(ScanlationProjectJpaEntity project, WorkflowTask task) {
        WorkflowTaskJpaEntity entity = new WorkflowTaskJpaEntity(task.getId().value(), project, task.getChapterNumber().value(), task.getStage().name(),
                task.getStatus().name(), task.getAssigneeId() != null ? task.getAssigneeId().value() : null, task.getUpdatedAt());
        syncPages(task, entity);
        return entity;
    }

    /// Updates the task's page rows in place by page number (keeps row identity; a number is unique per task).
    private static void syncPages(WorkflowTask task, WorkflowTaskJpaEntity entity) {
        Map<Integer, WorkflowTaskPageJpaEntity> byNumber = entity.getPages().stream()
                .collect(Collectors.toMap(WorkflowTaskPageJpaEntity::getPageNumber, page -> page));
        entity.getPages().removeIf(row -> task.getPages().stream().noneMatch(page -> page.pageNumber() == row.getPageNumber()));
        for (PageAsset page : task.getPages()) {
            WorkflowTaskPageJpaEntity row = byNumber.get(page.pageNumber());
            if (row == null) {
                row = new WorkflowTaskPageJpaEntity(entity, page.pageNumber());
                entity.getPages().add(row);
            }
            row.setStorageKey(page.storageKey());
            row.setCdnUrl(page.cdnUrl());
            row.setLiteCdnUrl(page.liteCdnUrl());
            row.setWidth(page.width());
            row.setHeight(page.height());
            row.setDescription(page.description());
        }
    }
}
