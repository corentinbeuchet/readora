package com.readora.web.controller;

import com.readora.application.port.in.ManageScanlationTaskUseCase;
import com.readora.domain.scanlation.ProjectId;
import com.readora.domain.scanlation.TaskId;
import com.readora.domain.scanlation.WorkflowTask;
import com.readora.domain.work.ChapterNumber;
import com.readora.web.dto.ApiResponse;
import com.readora.web.dto.CreateTaskRequest;
import com.readora.web.dto.SubmitTaskRequest;
import com.readora.web.dto.WorkflowTaskDto;
import com.readora.web.security.CurrentUserProvider;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/scanlation/projects/{projectId}/tasks")
@Tag(name = "Scanlation Pipeline", description = "Task claiming, asset submission, and stage progression")
public class ScanlationTaskController {

    private final ManageScanlationTaskUseCase scanlationTaskUseCase;
    private final CurrentUserProvider currentUserProvider;

    public ScanlationTaskController(ManageScanlationTaskUseCase scanlationTaskUseCase, CurrentUserProvider currentUserProvider) {
        this.scanlationTaskUseCase = scanlationTaskUseCase;
        this.currentUserProvider = currentUserProvider;
    }

    @PostMapping
    @PreAuthorize("hasAuthority('TASK_CLAIM') or hasAuthority('PROJECT_MANAGE') or hasAuthority('WORK_CREATE')")
    @Operation(summary = "Upload raw chapter package and create workflow task")
    public ResponseEntity<ApiResponse<WorkflowTaskDto>> createTask(
            @PathVariable UUID projectId,
            @Valid @RequestBody CreateTaskRequest request
    ) {
        WorkflowTask task = scanlationTaskUseCase.uploadChapterTask(
                ProjectId.of(projectId),
                ChapterNumber.of(request.chapterNumber().stripTrailingZeros().toPlainString()),
                request.assetUrl(),
                request.pageCount(),
                currentUserProvider.requireUserId()
        );
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(WorkflowTaskDto.fromDomain(task)));
    }

    @PostMapping("/{taskId}/claim")
    @PreAuthorize("hasAuthority('TASK_CLAIM')")
    @Operation(summary = "Claim a workflow task for the authenticated scanlator")
    public ResponseEntity<ApiResponse<WorkflowTaskDto>> claimTask(
            @PathVariable UUID projectId,
            @PathVariable UUID taskId
    ) {
        WorkflowTask task = scanlationTaskUseCase.claimTask(ProjectId.of(projectId), TaskId.of(taskId), currentUserProvider.requireUserId());
        return ResponseEntity.ok(ApiResponse.ok(WorkflowTaskDto.fromDomain(task)));
    }

    @PostMapping("/{taskId}/submit")
    @PreAuthorize("hasAuthority('TASK_SUBMIT')")
    @Operation(summary = "Submit task work package and advance stage")
    public ResponseEntity<ApiResponse<WorkflowTaskDto>> submitWork(
            @PathVariable UUID projectId,
            @PathVariable UUID taskId,
            @Valid @RequestBody SubmitTaskRequest request
    ) {
        WorkflowTask task = scanlationTaskUseCase.submitWork(
                ProjectId.of(projectId),
                TaskId.of(taskId),
                currentUserProvider.requireUserId(),
                request.assetUrl(),
                request.pageCount()
        );
        return ResponseEntity.ok(ApiResponse.ok(WorkflowTaskDto.fromDomain(task)));
    }

    @PostMapping("/{taskId}/publish")
    @PreAuthorize("hasAuthority('CHAPTER_PUBLISH')")
    @Operation(summary = "QC approve and publish chapter")
    public ResponseEntity<ApiResponse<String>> publishFromQC(
            @PathVariable UUID projectId,
            @PathVariable UUID taskId
    ) {
        scanlationTaskUseCase.publishChapterFromQC(ProjectId.of(projectId), TaskId.of(taskId), currentUserProvider.requireUserId());
        return ResponseEntity.ok(ApiResponse.ok("Chapter published successfully"));
    }
}
