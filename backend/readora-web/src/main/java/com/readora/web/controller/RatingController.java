package com.readora.web.controller;

import com.readora.application.port.in.RateWorkUseCase;
import com.readora.domain.rating.RatingId;
import com.readora.domain.rating.Review;
import com.readora.domain.work.WorkId;
import com.readora.web.dto.ApiResponse;
import com.readora.web.dto.RateWorkRequest;
import com.readora.web.dto.RatingDto;
import com.readora.web.dto.RatingSummaryDto;
import com.readora.web.dto.ReviewDto;
import com.readora.web.dto.ReviewRequest;
import com.readora.web.security.CurrentUserProvider;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1")
@Tag(name = "Ratings", description = "Ratings 1-10 and reviews of series (US-09)")
public class RatingController {

    private final RateWorkUseCase rateWorkUseCase;
    private final CurrentUserProvider currentUserProvider;

    public RatingController(RateWorkUseCase rateWorkUseCase, CurrentUserProvider currentUserProvider) {
        this.rateWorkUseCase = rateWorkUseCase;
        this.currentUserProvider = currentUserProvider;
    }

    @GetMapping("/works/{workId}/ratings")
    @Operation(summary = "Average rating and number of ratings of a series")
    public ResponseEntity<ApiResponse<RatingSummaryDto>> summary(@PathVariable UUID workId) {
        return ResponseEntity.ok(ApiResponse.ok(RatingSummaryDto.fromDomain(rateWorkUseCase.summary(WorkId.of(workId)))));
    }

    @GetMapping("/works/{workId}/reviews")
    @Operation(summary = "Reviews of a series, most helpful first")
    public ResponseEntity<ApiResponse<List<ReviewDto>>> reviews(@PathVariable UUID workId) {
        return ResponseEntity.ok(ApiResponse.ok(rateWorkUseCase.reviews(WorkId.of(workId)).stream().map(ReviewDto::fromDomain).toList()));
    }

    @GetMapping("/works/{workId}/rating/mine")
    @PreAuthorize("hasAuthority('RATE_WORK')")
    @Operation(summary = "My rating of a series (404 when not rated)")
    public ResponseEntity<ApiResponse<RatingDto>> mine(@PathVariable UUID workId) {
        return rateWorkUseCase.myRating(currentUserProvider.requireUserId(), WorkId.of(workId))
                .map(rating -> ResponseEntity.ok(ApiResponse.ok(RatingDto.fromDomain(rating))))
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PutMapping("/works/{workId}/rating")
    @PreAuthorize("hasAuthority('RATE_WORK')")
    @Operation(summary = "Rate a series 1-10 (rating again changes it)")
    public ResponseEntity<ApiResponse<RatingDto>> rate(@PathVariable UUID workId, @Valid @RequestBody RateWorkRequest request) {
        var rating = rateWorkUseCase.rate(currentUserProvider.requireUserId(), WorkId.of(workId), request.score());
        return ResponseEntity.ok(ApiResponse.ok(RatingDto.fromDomain(rating)));
    }

    @PutMapping("/works/{workId}/review")
    @PreAuthorize("hasAuthority('RATE_WORK')")
    @Operation(summary = "Write or update my review (with its rating)")
    public ResponseEntity<ApiResponse<RatingDto>> review(@PathVariable UUID workId, @Valid @RequestBody ReviewRequest request) {
        var rating = rateWorkUseCase.review(currentUserProvider.requireUserId(), WorkId.of(workId), request.score(),
                new Review(request.liked(), request.disliked(), request.verdict()));
        return ResponseEntity.ok(ApiResponse.ok(RatingDto.fromDomain(rating)));
    }

    @PostMapping("/reviews/{reviewId}/helpful")
    @PreAuthorize("hasAuthority('RATE_WORK')")
    @Operation(summary = "Mark someone else's review as helpful (once)")
    public ResponseEntity<ApiResponse<Map<String, Long>>> helpful(@PathVariable UUID reviewId) {
        long votes = rateWorkUseCase.markHelpful(currentUserProvider.requireUserId(), RatingId.of(reviewId));
        return ResponseEntity.ok(ApiResponse.ok(Map.of("helpfulVotes", votes)));
    }
}
