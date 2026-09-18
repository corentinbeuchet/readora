package com.readora.web.controller;

import com.readora.application.port.in.ReportPageUseCase;
import com.readora.domain.report.PageReportId;
import com.readora.domain.scanlation.ProjectId;
import com.readora.domain.work.ChapterId;
import com.readora.web.dto.ApiResponse;
import com.readora.web.dto.PageReportDto;
import com.readora.web.dto.ReportPageRequest;
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
@RequestMapping("/api/v1")
@Tag(name = "Page reports", description = "Readers report broken pages; the scanlation team fixes them (US-06)")
public class PageReportController {

    private final ReportPageUseCase reportPageUseCase;
    private final CurrentUserProvider currentUserProvider;

    public PageReportController(ReportPageUseCase reportPageUseCase, CurrentUserProvider currentUserProvider) {
        this.reportPageUseCase = reportPageUseCase;
        this.currentUserProvider = currentUserProvider;
    }

    @PostMapping("/chapters/{chapterId}/pages/{pageNumber}/reports")
    @PreAuthorize("hasAuthority('PAGE_REPORT')")
    @Operation(summary = "Report a page that doesn't display properly (reporting it again returns the open report)")
    public ResponseEntity<ApiResponse<PageReportDto>> report(@PathVariable UUID chapterId, @PathVariable int pageNumber,
                                                             @Valid @RequestBody ReportPageRequest request) {
        var report = reportPageUseCase.report(currentUserProvider.requireUserId(), ChapterId.of(chapterId), pageNumber, request.reason());
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(PageReportDto.fromDomain(report)));
    }

    @GetMapping("/scanlation/projects/{projectId}/page-reports")
    @PreAuthorize("hasAuthority('PROJECT_VIEW')")
    @Operation(summary = "Open page reports on the project's chapters (team members and admins)")
    public ResponseEntity<ApiResponse<List<PageReportDto>>> openReports(@PathVariable UUID projectId) {
        List<PageReportDto> reports = reportPageUseCase.openReports(currentUserProvider.requireUserId(), ProjectId.of(projectId)).stream()
                .map(PageReportDto::fromDomain)
                .toList();
        return ResponseEntity.ok(ApiResponse.ok(reports));
    }

    @PostMapping("/page-reports/{reportId}/resolve")
    @PreAuthorize("hasAuthority('PROJECT_VIEW')")
    @Operation(summary = "Mark a page report as fixed (the chapter's team or an admin)")
    public ResponseEntity<ApiResponse<PageReportDto>> resolve(@PathVariable UUID reportId) {
        var report = reportPageUseCase.resolve(currentUserProvider.requireUserId(), PageReportId.of(reportId));
        return ResponseEntity.ok(ApiResponse.ok(PageReportDto.fromDomain(report)));
    }
}
