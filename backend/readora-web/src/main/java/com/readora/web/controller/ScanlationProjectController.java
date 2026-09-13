package com.readora.web.controller;

import com.readora.application.port.in.BrowseCatalogUseCase;
import com.readora.domain.scanlation.ProjectId;
import com.readora.web.dto.ApiResponse;
import com.readora.web.dto.ScanlationProjectDto;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/scanlation/projects")
@Tag(name = "Scanlation Projects", description = "Project boards for scanlation teams")
public class ScanlationProjectController {

    private final BrowseCatalogUseCase browseCatalogUseCase;

    public ScanlationProjectController(BrowseCatalogUseCase browseCatalogUseCase) {
        this.browseCatalogUseCase = browseCatalogUseCase;
    }

    @GetMapping("/{projectId}")
    @PreAuthorize("hasAuthority('PROJECT_VIEW')")
    @Operation(summary = "Get a scanlation project with its members and tasks")
    public ResponseEntity<ApiResponse<ScanlationProjectDto>> getProject(@PathVariable UUID projectId) {
        return browseCatalogUseCase.getProject(ProjectId.of(projectId))
                .map(project -> ResponseEntity.ok(ApiResponse.ok(ScanlationProjectDto.fromDomain(project))))
                .orElseGet(() -> ResponseEntity.notFound().build());
    }
}
