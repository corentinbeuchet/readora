package com.readora.web.controller;

import com.readora.application.port.in.BrowseCatalogUseCase;
import com.readora.application.port.in.ManageScanlationTaskUseCase;
import com.readora.domain.scanlation.ProjectId;
import com.readora.domain.scanlation.TaskId;
import com.readora.domain.scanlation.WorkflowTask;
import com.readora.domain.work.ChapterNumber;
import com.readora.web.dto.ApiResponse;
import com.readora.web.dto.ChapterStatusDto;
import com.readora.web.dto.CreateTaskRequest;
import com.readora.web.dto.PageAssetDto;
import com.readora.web.dto.SubmitTaskRequest;
import com.readora.web.dto.WorkflowTaskDto;
import com.readora.web.security.AuthenticatedUser;
import com.readora.web.security.CurrentUserProvider;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/scanlation/projects/{projectId}/tasks")
@Tag(name = "Scanlation Pipeline", description = "Task claiming, asset submission, and stage progression")
public class ScanlationTaskController {

    private final ManageScanlationTaskUseCase scanlationTaskUseCase;
    private final BrowseCatalogUseCase catalog;
    private final CurrentUserProvider currentUserProvider;

    public ScanlationTaskController(ManageScanlationTaskUseCase scanlationTaskUseCase, BrowseCatalogUseCase catalog,
                                    CurrentUserProvider currentUserProvider) {
        this.scanlationTaskUseCase = scanlationTaskUseCase;
        this.catalog = catalog;
        this.currentUserProvider = currentUserProvider;
    }

    @GetMapping("/{taskId}/pages")
    @PreAuthorize("hasAuthority('LIBRARY_USE')")
    @Operation(summary = "The pages of a task as its last stage left them (the team's members)")
    public ResponseEntity<ApiResponse<List<PageAssetDto>>> taskPages(@PathVariable UUID projectId, @PathVariable UUID taskId) {
        return ResponseEntity.ok(ApiResponse.ok(catalog.taskPages(ProjectId.of(projectId), TaskId.of(taskId), currentUserProvider.requireUserId())
                .stream().map(PageAssetDto::fromDomain).toList()));
    }

    @PostMapping
    @PreAuthorize("hasAuthority('LIBRARY_USE')")
    @Operation(summary = "Put a chapter on the task board with its raw pages")
    public ResponseEntity<ApiResponse<WorkflowTaskDto>> createTask(
            @PathVariable UUID projectId,
            @Valid @RequestBody CreateTaskRequest request
    ) {
        AuthenticatedUser me = currentUserProvider.require();
        WorkflowTask task = scanlationTaskUseCase.uploadChapterTask(
                ProjectId.of(projectId),
                ChapterNumber.of(request.chapterNumber().toPlainString()),
                request.pages().stream().map(PageAssetDto::toDomain).toList(),
                me.userId()
        );
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(asSeenBy(task, me)));
    }

    @PostMapping("/{taskId}/claim")
    @PreAuthorize("hasAuthority('LIBRARY_USE')")
    @Operation(summary = "Claim a workflow task for the authenticated scanlator")
    public ResponseEntity<ApiResponse<WorkflowTaskDto>> claimTask(
            @PathVariable UUID projectId,
            @PathVariable UUID taskId
    ) {
        AuthenticatedUser me = currentUserProvider.require();
        WorkflowTask task = scanlationTaskUseCase.claimTask(ProjectId.of(projectId), TaskId.of(taskId), me.userId());
        return ResponseEntity.ok(ApiResponse.ok(asSeenBy(task, me)));
    }

    @PostMapping("/{taskId}/submit")
    @PreAuthorize("hasAuthority('LIBRARY_USE')")
    @Operation(summary = "Submit the stage's pages and advance the task")
    public ResponseEntity<ApiResponse<WorkflowTaskDto>> submitWork(
            @PathVariable UUID projectId,
            @PathVariable UUID taskId,
            @Valid @RequestBody SubmitTaskRequest request
    ) {
        AuthenticatedUser me = currentUserProvider.require();
        WorkflowTask task = scanlationTaskUseCase.submitWork(
                ProjectId.of(projectId),
                TaskId.of(taskId),
                me.userId(),
                request.pages().stream().map(PageAssetDto::toDomain).toList()
        );
        return ResponseEntity.ok(ApiResponse.ok(asSeenBy(task, me)));
    }

    @PostMapping("/{taskId}/publish")
    @PreAuthorize("hasAuthority('LIBRARY_USE')")
    @Operation(summary = "QC approve and publish chapter (a team's first chapter waits for a moderator: status PENDING_REVIEW)")
    public ResponseEntity<ApiResponse<ChapterStatusDto>> publishFromQC(
            @PathVariable UUID projectId,
            @PathVariable UUID taskId
    ) {
        var chapter = scanlationTaskUseCase.publishChapterFromQC(ProjectId.of(projectId), TaskId.of(taskId), currentUserProvider.requireUserId());
        return ResponseEntity.ok(ApiResponse.ok(ChapterStatusDto.fromDomain(chapter)));
    }

    /// The task right after the caller acted on it: only the caller can hold it then (claim assigns them, upload and
    /// submit leave it unassigned), so their username from the token names the assignee without a lookup.
    private static WorkflowTaskDto asSeenBy(WorkflowTask task, AuthenticatedUser me) {
        return WorkflowTaskDto.fromDomain(task, me.userId().equals(task.getAssigneeId()) ? me.username() : null);
    }
}
