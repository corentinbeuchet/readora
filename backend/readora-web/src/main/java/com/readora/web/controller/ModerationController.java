package com.readora.web.controller;

import com.readora.application.port.in.ModerateCommentsUseCase;
import com.readora.domain.social.CommentId;
import com.readora.web.dto.ApiResponse;
import com.readora.web.dto.ModerationItemDto;
import com.readora.web.dto.ReportCommentRequest;
import com.readora.web.security.CurrentUserProvider;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1")
@Tag(name = "Moderation", description = "Comment reports and the moderation queue (US-11)")
public class ModerationController {

    private final ModerateCommentsUseCase moderation;
    private final CurrentUserProvider currentUserProvider;

    public ModerationController(ModerateCommentsUseCase moderation, CurrentUserProvider currentUserProvider) {
        this.moderation = moderation;
        this.currentUserProvider = currentUserProvider;
    }

    @PostMapping("/comments/{commentId}/reports")
    @PreAuthorize("hasAuthority('COMMENT_REPORT')")
    @Operation(summary = "Report a comment to the moderators")
    public ResponseEntity<ApiResponse<Map<String, UUID>>> report(@PathVariable UUID commentId, @Valid @RequestBody ReportCommentRequest request) {
        var report = moderation.report(currentUserProvider.requireUserId(), CommentId.of(commentId), request.reason());
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(Map.of("reportId", report.getId())));
    }

    @GetMapping("/moderation/reports")
    @PreAuthorize("hasAuthority('COMMENT_MODERATE')")
    @Operation(summary = "Open comment reports, oldest first")
    public ResponseEntity<ApiResponse<List<ModerationItemDto>>> queue() {
        return ResponseEntity.ok(ApiResponse.ok(moderation.queue(currentUserProvider.requireUserId()).stream()
                .map(ModerationItemDto::fromDomain).toList()));
    }

    @PostMapping("/moderation/reports/{reportId}/hide")
    @PreAuthorize("hasAuthority('COMMENT_MODERATE')")
    @Operation(summary = "Hide the reported comment and close its reports")
    public ResponseEntity<ApiResponse<Map<String, String>>> hide(@PathVariable UUID reportId) {
        moderation.hide(currentUserProvider.requireUserId(), reportId);
        return ResponseEntity.ok(ApiResponse.ok(Map.of("status", "HIDDEN")));
    }

    @PostMapping("/moderation/reports/{reportId}/dismiss")
    @PreAuthorize("hasAuthority('COMMENT_MODERATE')")
    @Operation(summary = "Dismiss a report; the comment stays visible")
    public ResponseEntity<ApiResponse<Map<String, String>>> dismiss(@PathVariable UUID reportId) {
        moderation.dismiss(currentUserProvider.requireUserId(), reportId);
        return ResponseEntity.ok(ApiResponse.ok(Map.of("status", "DISMISSED")));
    }
}
