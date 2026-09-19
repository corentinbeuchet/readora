package com.readora.web.controller;

import com.readora.application.port.in.TrackReadingUseCase;
import com.readora.domain.work.ChapterId;
import com.readora.domain.work.WorkId;
import com.readora.web.dto.ApiResponse;
import com.readora.web.dto.ChapterReadDto;
import com.readora.web.dto.HistoryItemDto;
import com.readora.web.dto.RecordReadRequest;
import com.readora.web.dto.WorkProgressDto;
import com.readora.web.security.CurrentUserProvider;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/reading")
@PreAuthorize("hasAuthority('LIBRARY_USE')")
@Tag(name = "Reading", description = "Reading history and read markers (US-07)")
public class ReadingController {

    private final TrackReadingUseCase trackReadingUseCase;
    private final CurrentUserProvider currentUserProvider;

    public ReadingController(TrackReadingUseCase trackReadingUseCase, CurrentUserProvider currentUserProvider) {
        this.trackReadingUseCase = trackReadingUseCase;
        this.currentUserProvider = currentUserProvider;
    }

    @PutMapping("/chapters/{chapterId}")
    @Operation(summary = "Record that I opened (or finished) a chapter")
    public ResponseEntity<ApiResponse<ChapterReadDto>> recordRead(@PathVariable UUID chapterId, @Valid @RequestBody RecordReadRequest request) {
        var read = trackReadingUseCase.recordRead(currentUserProvider.requireUserId(), ChapterId.of(chapterId), request.finished());
        return ResponseEntity.ok(ApiResponse.ok(ChapterReadDto.fromDomain(read)));
    }

    @PostMapping("/chapters/{chapterId}/read-up-to")
    @Operation(summary = "Mark every published chapter before this one as read")
    public ResponseEntity<ApiResponse<WorkProgressDto>> markReadUpTo(@PathVariable UUID chapterId) {
        var progress = trackReadingUseCase.markReadUpTo(currentUserProvider.requireUserId(), ChapterId.of(chapterId));
        return ResponseEntity.ok(ApiResponse.ok(WorkProgressDto.fromDomain(progress)));
    }

    @GetMapping("/history")
    @Operation(summary = "The series I read most recently, newest first")
    public ResponseEntity<ApiResponse<List<HistoryItemDto>>> history(@RequestParam(defaultValue = "20") int limit) {
        List<HistoryItemDto> items = trackReadingUseCase.history(currentUserProvider.requireUserId(), limit).stream()
                .map(HistoryItemDto::fromDomain)
                .toList();
        return ResponseEntity.ok(ApiResponse.ok(items));
    }

    @GetMapping("/works/{workId}")
    @Operation(summary = "Which chapters of a series I finished, and which one is next")
    public ResponseEntity<ApiResponse<WorkProgressDto>> progress(@PathVariable UUID workId) {
        var progress = trackReadingUseCase.progress(currentUserProvider.requireUserId(), WorkId.of(workId));
        return ResponseEntity.ok(ApiResponse.ok(WorkProgressDto.fromDomain(progress)));
    }
}
