package com.readora.web.controller;

import com.readora.application.port.in.CommunityUseCase;
import com.readora.domain.common.UserId;
import com.readora.domain.scanlation.ProjectId;
import com.readora.web.dto.ApiResponse;
import com.readora.web.dto.PublicProfileDto;
import com.readora.web.dto.TeamPageDto;
import com.readora.web.security.AuthenticatedUser;
import com.readora.web.security.CurrentUserProvider;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1")
@Tag(name = "Community", description = "Public profiles, team pages and team follows (US-12)")
public class CommunityController {

    private final CommunityUseCase community;
    private final CurrentUserProvider currentUserProvider;

    public CommunityController(CommunityUseCase community, CurrentUserProvider currentUserProvider) {
        this.community = community;
        this.currentUserProvider = currentUserProvider;
    }

    @GetMapping("/users/{username}/profile")
    @Operation(summary = "A reader's public profile with reading stats")
    public ResponseEntity<ApiResponse<PublicProfileDto>> profile(@PathVariable String username) {
        return ResponseEntity.ok(ApiResponse.ok(PublicProfileDto.fromDomain(community.profile(username))));
    }

    @GetMapping("/teams/{projectId}")
    @Operation(summary = "A scanlation team's page: members, series, latest chapters, followers")
    public ResponseEntity<ApiResponse<TeamPageDto>> team(@PathVariable UUID projectId) {
        UserId viewer = currentUserProvider.current().map(AuthenticatedUser::userId).orElse(null);
        return ResponseEntity.ok(ApiResponse.ok(TeamPageDto.fromDomain(community.team(ProjectId.of(projectId), viewer))));
    }

    @PutMapping("/teams/{projectId}/follow")
    @PreAuthorize("hasAuthority('LIBRARY_USE')")
    @Operation(summary = "Follow a team: its chapters appear in my library updates")
    public ResponseEntity<ApiResponse<Map<String, Boolean>>> follow(@PathVariable UUID projectId) {
        community.follow(currentUserProvider.requireUserId(), ProjectId.of(projectId));
        return ResponseEntity.ok(ApiResponse.ok(Map.of("following", true)));
    }

    @DeleteMapping("/teams/{projectId}/follow")
    @PreAuthorize("hasAuthority('LIBRARY_USE')")
    @Operation(summary = "Stop following a team")
    public ResponseEntity<ApiResponse<Map<String, Boolean>>> unfollow(@PathVariable UUID projectId) {
        community.unfollow(currentUserProvider.requireUserId(), ProjectId.of(projectId));
        return ResponseEntity.ok(ApiResponse.ok(Map.of("following", false)));
    }
}
