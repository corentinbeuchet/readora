package com.readora.web.controller;

import com.readora.application.port.in.BrowseCatalogUseCase;
import com.readora.domain.work.Work;
import com.readora.domain.work.WorkId;
import com.readora.web.dto.ApiResponse;
import com.readora.web.dto.ChapterSummaryDto;
import com.readora.web.dto.PagedResponse;
import com.readora.web.dto.WorkDto;
import com.readora.web.dto.WorkSummaryDto;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/works")
@Tag(name = "Catalog", description = "Public browsing of works and their published chapters")
public class CatalogController {

    private final BrowseCatalogUseCase browseCatalogUseCase;

    public CatalogController(BrowseCatalogUseCase browseCatalogUseCase) {
        this.browseCatalogUseCase = browseCatalogUseCase;
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
}
