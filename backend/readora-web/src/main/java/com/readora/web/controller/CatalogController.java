package com.readora.web.controller;

import com.readora.application.port.in.BrowseCatalogUseCase;
import com.readora.application.port.in.DirectPublishChapterUseCase;
import com.readora.application.port.in.ManageWorkUseCase;
import com.readora.domain.work.Chapter;
import com.readora.domain.work.PageAsset;
import com.readora.domain.work.Work;
import com.readora.domain.work.WorkId;
import com.readora.web.dto.*;
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
@RequestMapping("/api/v1/works")
@Tag(name = "Catalog", description = "Public browsing and creator management of works and published chapters")
public class CatalogController {

    private final BrowseCatalogUseCase browseCatalogUseCase;
    private final ManageWorkUseCase manageWorkUseCase;
    private final DirectPublishChapterUseCase directPublishChapterUseCase;
    private final CurrentUserProvider currentUserProvider;

    public CatalogController(BrowseCatalogUseCase browseCatalogUseCase,
                             ManageWorkUseCase manageWorkUseCase,
                             DirectPublishChapterUseCase directPublishChapterUseCase,
                             CurrentUserProvider currentUserProvider) {
        this.browseCatalogUseCase = browseCatalogUseCase;
        this.manageWorkUseCase = manageWorkUseCase;
        this.directPublishChapterUseCase = directPublishChapterUseCase;
        this.currentUserProvider = currentUserProvider;
    }

    @GetMapping
    @Operation(summary = "List works (paginated)")
    public ResponseEntity<ApiResponse<PagedResponse<WorkSummaryDto>>> listWorks(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        BrowseCatalogUseCase.Page<Work> result = browseCatalogUseCase.listWorks(page, size);
        return ResponseEntity.ok(ApiResponse.ok(PagedResponse.from(result, WorkSummaryDto::fromDomain)));
    }

    @GetMapping("/{workId}")
    @Operation(summary = "Get work details")
    public ResponseEntity<ApiResponse<WorkDto>> getWork(@PathVariable UUID workId) {
        return browseCatalogUseCase.getWork(WorkId.of(workId))
                .map(work -> ResponseEntity.ok(ApiResponse.ok(WorkDto.fromDomain(work))))
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @GetMapping("/{workId}/chapters")
    @Operation(summary = "List published chapters of a work")
    public ResponseEntity<ApiResponse<List<ChapterSummaryDto>>> listChapters(@PathVariable UUID workId) {
        List<ChapterSummaryDto> chapters = browseCatalogUseCase.listPublishedChapters(WorkId.of(workId)).stream()
                .map(ChapterSummaryDto::fromDomain)
                .toList();
        return ResponseEntity.ok(ApiResponse.ok(chapters));
    }

    @GetMapping("/{workId}/projects")
    @PreAuthorize("hasAuthority('PROJECT_VIEW') or hasAuthority('WORK_CREATE')")
    @Operation(summary = "List scanlation projects of a work")
    public ResponseEntity<ApiResponse<List<ScanlationProjectDto>>> listProjects(@PathVariable UUID workId) {
        List<ScanlationProjectDto> projects = browseCatalogUseCase.listProjectsByWork(WorkId.of(workId)).stream()
                .map(ScanlationProjectDto::fromDomain)
                .toList();
        return ResponseEntity.ok(ApiResponse.ok(projects));
    }

    @PostMapping
    @PreAuthorize("hasAuthority('WORK_CREATE')")
    @Operation(summary = "Create a new manga / comic work")
    public ResponseEntity<ApiResponse<WorkDto>> createWork(
            @Valid @RequestBody CreateWorkRequest request
    ) {
        Work work = manageWorkUseCase.createWork(
                request.title(),
                request.synopsis(),
                request.type(),
                request.status(),
                request.coverImageUrl(),
                request.genres(),
                currentUserProvider.requireUserId()
        );
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(WorkDto.fromDomain(work)));
    }

    @PostMapping("/{workId}/chapters/direct")
    @PreAuthorize("hasAuthority('CHAPTER_PUBLISH') or hasAuthority('WORK_CREATE')")
    @Operation(summary = "Directly publish a chapter with pages for a work")
    public ResponseEntity<ApiResponse<ChapterDto>> directPublishChapter(
            @PathVariable UUID workId,
            @Valid @RequestBody DirectPublishChapterRequest request
    ) {
        List<PageAsset> pages = request.pages().stream()
                .map(p -> new PageAsset(p.pageNumber(), p.storageKey(), p.cdnUrl(), p.width(), p.height()))
                .toList();
        Chapter chapter = directPublishChapterUseCase.directPublishChapter(
                WorkId.of(workId),
                request.chapterNumber(),
                request.title(),
                pages,
                currentUserProvider.requireUserId()
        );
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(ChapterDto.fromDomain(chapter)));
    }
}
