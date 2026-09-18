package com.readora.infrastructure.persistence.adapter;

import com.readora.application.port.out.ScanlationProjectRepositoryPort;
import com.readora.domain.scanlation.*;
import com.readora.domain.work.ChapterNumber;
import com.readora.domain.work.UserId;
import com.readora.domain.work.WorkId;
import com.readora.infrastructure.persistence.entity.ScanlationProjectJpaEntity;
import com.readora.infrastructure.persistence.entity.TeamMemberJpaEntity;
import com.readora.infrastructure.persistence.entity.WorkflowTaskJpaEntity;
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
    public Optional<ScanlationProject> findById(ProjectId id) {
        return springDataRepository.findById(id.value()).map(this::toDomain);
    }

    @Override
    public List<ScanlationProject> findByWorkId(WorkId workId) {
        return springDataRepository.findByWorkId(workId.value()).stream()
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
            existing.setUpdatedAt(project.getUpdatedAt());

            // Update members in place
            Map<String, TeamMemberJpaEntity> existingMembersByUserId = existing.getMembers().stream()
                    .collect(Collectors.toMap(TeamMemberJpaEntity::getUserId, m -> m));

            existing.getMembers().removeIf(em -> project.getMembers().stream().noneMatch(m -> m.userId().value().equals(em.getUserId())));

            for (TeamMember m : project.getMembers()) {
                TeamMemberJpaEntity memberEntity = existingMembersByUserId.get(m.userId().value());
                List<String> roles = m.roles().stream().map(Enum::name).toList();
                if (memberEntity != null) {
                    memberEntity.setRoles(new ArrayList<>(roles));
                    memberEntity.setJoinedAt(m.joinedAt());
                } else {
                    existing.getMembers().add(new TeamMemberJpaEntity(existing, m.userId().value(), new ArrayList<>(roles), m.joinedAt()));
                }
            }

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
                    taskEntity.setAssetPackageUrl(t.getAssetPackageUrl());
                    taskEntity.setPageCount(t.getPageCount());
                    taskEntity.setUpdatedAt(t.getUpdatedAt());
                } else {
                    existing.getTasks().add(new WorkflowTaskJpaEntity(
                            t.getId().value(),
                            existing,
                            t.getChapterNumber().value(),
                            t.getStage().name(),
                            t.getStatus().name(),
                            t.getAssigneeId() != null ? t.getAssigneeId().value() : null,
                            t.getAssetPackageUrl(),
                            t.getPageCount(),
                            t.getUpdatedAt()
                    ));
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
        Set<TeamMember> members = entity.getMembers() != null ?
                entity.getMembers().stream()
                        .map(m -> new TeamMember(
                                UserId.of(m.getUserId()),
                                m.getRoles().stream().map(ScanlationRole::valueOf).collect(Collectors.toSet()),
                                m.getJoinedAt()
                        )).collect(Collectors.toSet()) : new HashSet<>();

        List<WorkflowTask> tasks = entity.getTasks() != null ?
                entity.getTasks().stream()
                        .map(t -> new WorkflowTask(
                                TaskId.of(t.getId()),
                                ChapterNumber.of(t.getChapterNumber()),
                                WorkflowStage.valueOf(t.getStage()),
                                TaskStatus.valueOf(t.getStatus()),
                                t.getAssigneeId() != null ? UserId.of(t.getAssigneeId()) : null,
                                t.getAssetPackageUrl(),
                                t.getPageCount(),
                                t.getUpdatedAt()
                        )).toList() : List.of();

        return new ScanlationProject(
                ProjectId.of(entity.getId()),
                entity.getName(),
                WorkId.of(entity.getWorkId()),
                members,
                tasks,
                entity.getCreatedAt(),
                entity.getUpdatedAt()
        );
    }

    private ScanlationProjectJpaEntity toEntity(ScanlationProject project) {
        ScanlationProjectJpaEntity entity = new ScanlationProjectJpaEntity(
                project.getId().value(),
                project.getName(),
                project.getWorkId().value(),
                project.getCreatedAt(),
                project.getUpdatedAt()
        );

        List<TeamMemberJpaEntity> memberEntities = new ArrayList<>();
        if (project.getMembers() != null) {
            for (TeamMember m : project.getMembers()) {
                List<String> roles = m.roles().stream().map(Enum::name).toList();
                memberEntities.add(new TeamMemberJpaEntity(entity, m.userId().value(), roles, m.joinedAt()));
            }
        }
        entity.setMembers(memberEntities);

        List<WorkflowTaskJpaEntity> taskEntities = new ArrayList<>();
        if (project.getTasks() != null) {
            for (WorkflowTask t : project.getTasks()) {
                taskEntities.add(new WorkflowTaskJpaEntity(
                        t.getId().value(),
                        entity,
                        t.getChapterNumber().value(),
                        t.getStage().name(),
                        t.getStatus().name(),
                        t.getAssigneeId() != null ? t.getAssigneeId().value() : null,
                        t.getAssetPackageUrl(),
                        t.getPageCount(),
                        t.getUpdatedAt()
                ));
            }
        }
        entity.setTasks(taskEntities);

        return entity;
    }
}
