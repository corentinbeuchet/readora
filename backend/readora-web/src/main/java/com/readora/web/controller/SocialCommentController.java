package com.readora.web.controller;

import com.readora.application.port.in.ReaderInteractionUseCase;
import com.readora.domain.social.ChapterComment;
import com.readora.domain.social.CommentId;
import com.readora.domain.work.ChapterId;
import com.readora.web.dto.ApiResponse;
import com.readora.web.dto.CommentDto;
import com.readora.web.dto.CommentUpvoteDto;
import com.readora.web.dto.CreateCommentRequest;
import com.readora.web.security.AuthenticatedUser;
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
@RequestMapping("/api/v1/comments")
@Tag(name = "Reader Social & Comments", description = "Threaded comments, ratings, and upvoting")
public class SocialCommentController {

    private final ReaderInteractionUseCase readerInteractionUseCase;
    private final CurrentUserProvider currentUserProvider;

    public SocialCommentController(ReaderInteractionUseCase readerInteractionUseCase, CurrentUserProvider currentUserProvider) {
        this.readerInteractionUseCase = readerInteractionUseCase;
        this.currentUserProvider = currentUserProvider;
    }

    @GetMapping("/chapter/{chapterId}")
    @Operation(summary = "Get threaded comments for chapter")
    public ResponseEntity<ApiResponse<List<CommentDto>>> getChapterComments(@PathVariable UUID chapterId) {
        List<ChapterComment> comments = readerInteractionUseCase.getCommentsForChapter(ChapterId.of(chapterId));
        List<CommentDto> dtos = comments.stream().map(CommentDto::fromDomain).toList();
        return ResponseEntity.ok(ApiResponse.ok(dtos));
    }

    @GetMapping("/chapter/{chapterId}/top")
    @Operation(summary = "The most upvoted comments without spoilers, for the end of the chapter")
    public ResponseEntity<ApiResponse<List<CommentDto>>> getTopComments(@PathVariable UUID chapterId,
                                                                        @RequestParam(defaultValue = "3") int limit) {
        List<CommentDto> dtos = readerInteractionUseCase.topComments(ChapterId.of(chapterId), limit).stream()
                .map(CommentDto::fromDomain)
                .toList();
        return ResponseEntity.ok(ApiResponse.ok(dtos));
    }

    @PostMapping("/chapter/{chapterId}")
    @PreAuthorize("hasAuthority('COMMENT_WRITE')")
    @Operation(summary = "Post a comment or reply on chapter (author taken from the authenticated principal)")
    public ResponseEntity<ApiResponse<CommentDto>> postComment(
            @PathVariable UUID chapterId,
            @Valid @RequestBody CreateCommentRequest request
    ) {
        AuthenticatedUser author = currentUserProvider.require();
        ChapterComment comment;
        if (request.parentId() != null) {
            comment = readerInteractionUseCase.replyToComment(
                    CommentId.of(request.parentId()),
                    author.userId(),
                    author.username(),
                    request.content(),
                    request.isSpoiler()
            );
        } else {
            comment = readerInteractionUseCase.postRootComment(
                    ChapterId.of(chapterId),
                    author.userId(),
                    author.username(),
                    request.content(),
                    request.pageReference(),
                    request.isSpoiler()
            );
        }
        return ResponseEntity.ok(ApiResponse.ok(CommentDto.fromDomain(comment)));
    }

    @PostMapping("/{commentId}/upvote")
    @PreAuthorize("hasAuthority('COMMENT_UPVOTE')")
    @Operation(summary = "Upvote a comment")
    public ResponseEntity<ApiResponse<CommentUpvoteDto>> upvoteComment(@PathVariable UUID commentId) {
        var outcome = readerInteractionUseCase.upvoteComment(CommentId.of(commentId), currentUserProvider.requireUserId());
        return ResponseEntity.ok(ApiResponse.ok(CommentUpvoteDto.fromDomain(outcome)));
    }
}
