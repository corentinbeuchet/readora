package com.readora.web.controller;

import com.readora.application.port.in.ManageProfileUseCase;
import com.readora.domain.identity.UserAccount;
import com.readora.web.dto.ApiResponse;
import com.readora.web.dto.UpdateProfileRequest;
import com.readora.web.dto.UserProfileDto;
import com.readora.web.security.CurrentUserProvider;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/profile")
@Tag(name = "Profile", description = "Authenticated user's profile")
public class ProfileController {

    private final ManageProfileUseCase manageProfileUseCase;
    private final CurrentUserProvider currentUserProvider;

    public ProfileController(ManageProfileUseCase manageProfileUseCase, CurrentUserProvider currentUserProvider) {
        this.manageProfileUseCase = manageProfileUseCase;
        this.currentUserProvider = currentUserProvider;
    }

    @PutMapping
    @Operation(summary = "Update my display name, bio and avatar")
    public ResponseEntity<ApiResponse<UserProfileDto>> updateProfile(@Valid @RequestBody UpdateProfileRequest request) {
        UserAccount account = manageProfileUseCase.updateProfile(
                currentUserProvider.requireUserId(),
                request.displayName(),
                request.bio(),
                request.avatarUrl()
        );
        return ResponseEntity.ok(ApiResponse.ok(UserProfileDto.fromDomain(account)));
    }
}
