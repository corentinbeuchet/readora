package com.readora.web.dto;

import com.readora.application.port.in.BrowseCatalogUseCase.ProjectBoard;
import com.readora.domain.scanlation.ScanlationRole;
import com.readora.domain.scanlation.TeamMember;
import org.jspecify.annotations.Nullable;

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
        boolean boardEnabled,
        List<TeamMemberDto> members,
        List<WorkflowTaskDto> tasks,
        Instant createdAt,
        Instant updatedAt
) {
    /// @param username `null` when the account no longer exists
    public record TeamMemberDto(String userId, @Nullable String username, List<String> roles) {
        static TeamMemberDto fromDomain(TeamMember member, @Nullable String username) {
            return new TeamMemberDto(
                    member.userId().value(),
                    username,
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
                project.isBoardEnabled(),
                board.team().getMembers().stream()
                        .sorted(Comparator.comparing(m -> m.userId().value()))
                        .map(member -> TeamMemberDto.fromDomain(member, board.usernameOf(member.userId())))
                        .toList(),
                project.getTasks().stream()
                        .map(task -> WorkflowTaskDto.fromDomain(task, task.getAssigneeId() != null ? board.usernameOf(task.getAssigneeId()) : null))
                        .toList(),
                project.getCreatedAt(),
                project.getUpdatedAt()
        );
    }
}
