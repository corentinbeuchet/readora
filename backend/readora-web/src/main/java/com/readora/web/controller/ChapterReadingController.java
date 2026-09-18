package com.readora.web.controller;

import com.readora.application.port.in.ReadChapterUseCase;
import com.readora.domain.work.Chapter;
import com.readora.domain.work.ChapterId;
import com.readora.domain.common.UserId;
import com.readora.web.dto.ApiResponse;
import com.readora.web.dto.ChapterDto;
import com.readora.web.security.AuthenticatedUser;
import com.readora.web.security.CurrentUserProvider;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/chapters")
@Tag(name = "Chapter Reading", description = "Endpoints for loading and streaming chapter pages")
public class ChapterReadingController {

    static final UserId ANONYMOUS_READER = UserId.of("anonymous");

    private final ReadChapterUseCase readChapterUseCase;
    private final CurrentUserProvider currentUserProvider;

    public ChapterReadingController(ReadChapterUseCase readChapterUseCase, CurrentUserProvider currentUserProvider) {
        this.readChapterUseCase = readChapterUseCase;
        this.currentUserProvider = currentUserProvider;
    }

    @GetMapping("/{chapterId}")
    @Operation(summary = "Get chapter metadata and pages for reader viewer")
    public ResponseEntity<ApiResponse<ChapterDto>> getChapter(
            @PathVariable UUID chapterId,
            @RequestParam(defaultValue = "VERTICAL") String viewMode
    ) {
        UserId readerId = currentUserProvider.current().map(AuthenticatedUser::userId).orElse(ANONYMOUS_READER);
        var reading = readChapterUseCase.readChapter(ChapterId.of(chapterId), readerId, viewMode);
        return ResponseEntity.ok(ApiResponse.ok(ChapterDto.fromReading(reading)));
    }
}
