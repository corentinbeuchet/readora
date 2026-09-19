package com.readora.web.controller;

import com.readora.application.port.in.BrowseCatalogUseCase.CatalogQuery;
import com.readora.application.port.in.DiscoverUseCase;
import com.readora.application.port.in.DiscoverUseCase.Period;
import com.readora.domain.common.UserId;
import com.readora.domain.work.Demographic;
import com.readora.domain.work.WorkStatus;
import com.readora.domain.work.WorkType;
import com.readora.web.dto.ApiResponse;
import com.readora.web.dto.RankedWorkDto;
import com.readora.web.dto.ReleaseDto;
import com.readora.web.dto.WorkSummaryDto;
import com.readora.web.security.AuthenticatedUser;
import com.readora.web.security.CurrentUserProvider;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Set;

@RestController
@RequestMapping("/api/v1")
@Tag(name = "Discovery", description = "Latest updates, rankings and random picks (US-08)")
public class DiscoveryController {

    private final DiscoverUseCase discoverUseCase;
    private final CurrentUserProvider currentUserProvider;

    public DiscoveryController(DiscoverUseCase discoverUseCase, CurrentUserProvider currentUserProvider) {
        this.discoverUseCase = discoverUseCase;
        this.currentUserProvider = currentUserProvider;
    }

    @GetMapping("/updates")
    @Operation(summary = "Latest published chapters, newest first (mine=true: my library and followed teams, needs sign-in)")
    public ResponseEntity<ApiResponse<List<ReleaseDto>>> latest(@RequestParam(defaultValue = "false") boolean mine,
                                                                @RequestParam(defaultValue = "0") int page) {
        UserId viewer = mine ? currentUserProvider.requireUserId() : currentUserProvider.current().map(AuthenticatedUser::userId).orElse(null);
        List<ReleaseDto> releases = discoverUseCase.latest(viewer, mine, page).stream().map(ReleaseDto::fromDomain).toList();
        return ResponseEntity.ok(ApiResponse.ok(releases));
    }

    @GetMapping("/rankings/popular")
    @Operation(summary = "Most active series in the period (reads, comments, library adds)")
    public ResponseEntity<ApiResponse<List<RankedWorkDto>>> popular(@RequestParam(defaultValue = "WEEK") Period period) {
        return ResponseEntity.ok(ApiResponse.ok(discoverUseCase.popular(period).stream().map(RankedWorkDto::fromDomain).toList()));
    }

    @GetMapping("/rankings/top-rated")
    @Operation(summary = "Best average rating, among series with at least 5 ratings")
    public ResponseEntity<ApiResponse<List<RankedWorkDto>>> topRated() {
        return ResponseEntity.ok(ApiResponse.ok(discoverUseCase.topRated().stream().map(RankedWorkDto::fromDomain).toList()));
    }

    @GetMapping("/works/random")
    @Operation(summary = "A random series matching the catalog filters (404 when none matches)")
    public ResponseEntity<ApiResponse<WorkSummaryDto>> random(
            @RequestParam(name = "genre", defaultValue = "") Set<String> genres,
            @RequestParam(name = "excludeGenre", defaultValue = "") Set<String> excludedGenres,
            @RequestParam(name = "type", defaultValue = "") Set<WorkType> types,
            @RequestParam(name = "status", defaultValue = "") Set<WorkStatus> statuses,
            @RequestParam(name = "demographic", defaultValue = "") Set<Demographic> demographics
    ) {
        var query = new CatalogQuery(null, genres, excludedGenres, types, statuses, demographics);
        return discoverUseCase.surprise(query)
                .map(work -> ResponseEntity.ok(ApiResponse.ok(WorkSummaryDto.fromDomain(work))))
                .orElseGet(() -> ResponseEntity.notFound().build());
    }
}
