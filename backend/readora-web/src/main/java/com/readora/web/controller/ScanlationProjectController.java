package com.readora.web.controller;

import com.readora.application.port.in.BrowseCatalogUseCase;
import com.readora.application.port.in.ManageTeamUseCase;
import com.readora.domain.common.UserId;
import com.readora.domain.scanlation.ProjectId;
import com.readora.web.dto.ApiResponse;
import com.readora.web.dto.BoardSwitchRequest;
import com.readora.web.dto.ScanlationProjectDto;
import com.readora.web.security.CurrentUserProvider;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/scanlation/projects")
@Tag(name = "Scanlation Projects", description = "Project boards for scanlation teams")
public class ScanlationProjectController {

    private final BrowseCatalogUseCase browseCatalogUseCase;
    private final ManageTeamUseCase teams;
    private final CurrentUserProvider currentUserProvider;

    public ScanlationProjectController(BrowseCatalogUseCase browseCatalogUseCase, ManageTeamUseCase teams, CurrentUserProvider currentUserProvider) {
        this.browseCatalogUseCase = browseCatalogUseCase;
        this.teams = teams;
        this.currentUserProvider = currentUserProvider;
    }

    @GetMapping("/{projectId}")
    @PreAuthorize("hasAuthority('LIBRARY_USE')")
    @Operation(summary = "Get a scanlation project with its members and tasks")
    public ResponseEntity<ApiResponse<ScanlationProjectDto>> getProject(@PathVariable UUID projectId) {
        return browseCatalogUseCase.getProject(ProjectId.of(projectId), currentUserProvider.requireUserId())
                .map(project -> ResponseEntity.ok(ApiResponse.ok(ScanlationProjectDto.fromDomain(project))))
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PutMapping("/{projectId}/board")
    @PreAuthorize("hasAuthority('LIBRARY_USE')")
    @Operation(summary = "Turn the task board of one of my team's series on or off (team leaders)")
    public ResponseEntity<ApiResponse<ScanlationProjectDto>> setBoard(@PathVariable UUID projectId, @Valid @RequestBody BoardSwitchRequest request) {
        UserId me = currentUserProvider.requireUserId();
        teams.setBoard(me, ProjectId.of(projectId), request.enabled());
        return browseCatalogUseCase.getProject(ProjectId.of(projectId), me)
                .map(board -> ResponseEntity.ok(ApiResponse.ok(ScanlationProjectDto.fromDomain(board))))
                .orElseThrow();
    }
}
