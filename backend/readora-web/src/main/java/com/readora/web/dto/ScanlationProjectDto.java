package com.readora.web.dto;

import com.readora.application.port.in.BrowseCatalogUseCase.ProjectBoard;
import com.readora.domain.scanlation.ScanlationRole;
import com.readora.domain.scanlation.TeamMember;

import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

public record ScanlationProjectDto(
        UUID id,
        String name,
        UUID workId,
        UUID teamId,
        String teamName,
        List<TeamMemberDto> members,
        List<WorkflowTaskDto> tasks,
        Instant createdAt,
        Instant updatedAt
) {
    public record TeamMemberDto(String userId, List<String> roles) {
        static TeamMemberDto fromDomain(TeamMember member) {
            return new TeamMemberDto(
                    member.userId().value(),
                    member.roles().stream().map(ScanlationRole::name).sorted().toList()
            );
        }
    }

    public static ScanlationProjectDto fromDomain(ProjectBoard board) {
        var project = board.project();
        return new ScanlationProjectDto(
                project.getId().value(),
                project.getName(),
                project.getWorkId().value(),
                board.team().getId().value(),
                board.team().getName(),
                board.team().getMembers().stream()
                        .sorted(Comparator.comparing(m -> m.userId().value()))
                        .map(TeamMemberDto::fromDomain)
                        .toList(),
                project.getTasks().stream().map(WorkflowTaskDto::fromDomain).toList(),
                project.getCreatedAt(),
                project.getUpdatedAt()
        );
    }
}
