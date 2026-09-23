package com.readora.web.controller;

import com.readora.application.port.in.ManageBookmarkUseCase;
import com.readora.domain.social.Bookmark;
import com.readora.domain.work.ChapterId;
import com.readora.domain.work.WorkId;
import com.readora.web.dto.ApiResponse;
import com.readora.web.dto.BookmarkDto;
import com.readora.web.dto.UpdateProgressRequest;
import com.readora.web.security.CurrentUserProvider;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/bookmarks")
@Tag(name = "Bookmarks", description = "Reading progress and bookmarks")
public class BookmarkController {

    private final ManageBookmarkUseCase manageBookmarkUseCase;
    private final CurrentUserProvider currentUserProvider;

    public BookmarkController(ManageBookmarkUseCase manageBookmarkUseCase, CurrentUserProvider currentUserProvider) {
        this.manageBookmarkUseCase = manageBookmarkUseCase;
        this.currentUserProvider = currentUserProvider;
    }

    @GetMapping
    @PreAuthorize("hasAuthority('LIBRARY_USE')")
    @Operation(summary = "List my bookmarks")
    public ResponseEntity<ApiResponse<List<BookmarkDto>>> listBookmarks() {
        List<Bookmark> bookmarks = manageBookmarkUseCase.listBookmarks(currentUserProvider.requireUserId());
        return ResponseEntity.ok(ApiResponse.ok(bookmarks.stream().map(BookmarkDto::fromDomain).toList()));
    }

    @GetMapping("/{workId}")
    @PreAuthorize("hasAuthority('LIBRARY_USE')")
    @Operation(summary = "Get my bookmark for a work")
    public ResponseEntity<ApiResponse<BookmarkDto>> getBookmark(@PathVariable UUID workId) {
        return manageBookmarkUseCase.getBookmark(currentUserProvider.requireUserId(), WorkId.of(workId))
                .map(bookmark -> ResponseEntity.ok(ApiResponse.ok(BookmarkDto.fromDomain(bookmark))))
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PutMapping("/{workId}/progress")
    @PreAuthorize("hasAuthority('LIBRARY_USE')")
    @Operation(summary = "Save my reading progress for a work")
    public ResponseEntity<ApiResponse<BookmarkDto>> updateProgress(
            @PathVariable UUID workId,
            @Valid @RequestBody UpdateProgressRequest request
    ) {
        Bookmark bookmark = manageBookmarkUseCase.updateProgress(
                currentUserProvider.requireUserId(),
                WorkId.of(workId),
                ChapterId.of(request.chapterId()),
                request.pageIndex()
        );
        return ResponseEntity.ok(ApiResponse.ok(BookmarkDto.fromDomain(bookmark)));
    }
}
