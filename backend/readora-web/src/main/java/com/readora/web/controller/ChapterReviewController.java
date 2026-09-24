package com.readora.web.controller;

import com.readora.application.port.in.ReviewChaptersUseCase;
import com.readora.domain.work.ChapterId;
import com.readora.web.dto.ApiResponse;
import com.readora.web.dto.ChapterStatusDto;
import com.readora.web.dto.WaitingChapterDto;
import com.readora.web.security.CurrentUserProvider;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/moderation/chapters")
@Tag(name = "Moderation", description = "A team's first chapter waits for a moderator (US-11)")
public class ChapterReviewController {

    private final ReviewChaptersUseCase review;
    private final CurrentUserProvider currentUserProvider;

    public ChapterReviewController(ReviewChaptersUseCase review, CurrentUserProvider currentUserProvider) {
        this.review = review;
        this.currentUserProvider = currentUserProvider;
    }

    @GetMapping
    @PreAuthorize("hasAuthority('COMMENT_MODERATE')")
    @Operation(summary = "Chapters waiting for review, the longest-waiting first")
    public ResponseEntity<ApiResponse<List<WaitingChapterDto>>> waiting() {
        return ResponseEntity.ok(ApiResponse.ok(review.waiting(currentUserProvider.requireUserId()).stream()
                .map(WaitingChapterDto::fromDomain).toList()));
    }

    @PostMapping("/{chapterId}/approve")
    @PreAuthorize("hasAuthority('COMMENT_MODERATE')")
    @Operation(summary = "Publish a chapter waiting for review")
    public ResponseEntity<ApiResponse<ChapterStatusDto>> approve(@PathVariable UUID chapterId) {
        var chapter = review.approve(currentUserProvider.requireUserId(), ChapterId.of(chapterId));
        return ResponseEntity.ok(ApiResponse.ok(ChapterStatusDto.fromDomain(chapter)));
    }

    @PostMapping("/{chapterId}/send-back")
    @PreAuthorize("hasAuthority('COMMENT_MODERATE')")
    @Operation(summary = "Send a chapter back to its team as a draft")
    public ResponseEntity<ApiResponse<ChapterStatusDto>> sendBack(@PathVariable UUID chapterId) {
        var chapter = review.sendBack(currentUserProvider.requireUserId(), ChapterId.of(chapterId));
        return ResponseEntity.ok(ApiResponse.ok(ChapterStatusDto.fromDomain(chapter)));
    }
}
