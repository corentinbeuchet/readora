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
    public ScanlationProject save(ScanlationProject project) {
        ScanlationProjectJpaEntity entity = toEntity(project);
        ScanlationProjectJpaEntity saved = springDataRepository.save(entity);
        return toDomain(saved);
    }

    private ScanlationProject toDomain(ScanlationProjectJpaEntity entity) {
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
