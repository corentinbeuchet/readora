package com.readora.web.controller;

import com.readora.application.port.in.AdministerAccountsUseCase;
import com.readora.domain.common.UserId;
import com.readora.web.dto.AdminAccountDto;
import com.readora.web.dto.ApiResponse;
import com.readora.web.dto.AssignRoleRequest;
import com.readora.web.dto.SuspendAccountRequest;
import com.readora.web.security.CurrentUserProvider;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/admin/accounts")
@Tag(name = "Administration", description = "Looking after accounts (US-16, admins)")
public class AdminController {

    private final AdministerAccountsUseCase administration;
    private final CurrentUserProvider currentUserProvider;

    public AdminController(AdministerAccountsUseCase administration, CurrentUserProvider currentUserProvider) {
        this.administration = administration;
        this.currentUserProvider = currentUserProvider;
    }

    @GetMapping
    @PreAuthorize("hasAuthority('USER_MANAGE')")
    @Operation(summary = "Accounts whose username or email starts with q")
    public ResponseEntity<ApiResponse<List<AdminAccountDto>>> search(@RequestParam("q") String query) {
        return ResponseEntity.ok(ApiResponse.ok(administration.search(currentUserProvider.requireUserId(), query).stream()
                .map(AdminAccountDto::fromDomain).toList()));
    }

    @PutMapping("/{accountId}/role")
    @PreAuthorize("hasAuthority('USER_MANAGE')")
    @Operation(summary = "Give an account its one role (reader, moderator, admin)")
    public ResponseEntity<ApiResponse<AdminAccountDto>> assignRole(@PathVariable String accountId, @Valid @RequestBody AssignRoleRequest request) {
        return ok(administration.assignRole(currentUserProvider.requireUserId(), UserId.of(accountId), request.role()));
    }

    @PostMapping("/{accountId}/suspend")
    @PreAuthorize("hasAuthority('USER_MANAGE')")
    @Operation(summary = "Keep an account out for some days; its sessions end")
    public ResponseEntity<ApiResponse<AdminAccountDto>> suspend(@PathVariable String accountId, @Valid @RequestBody SuspendAccountRequest request) {
        return ok(administration.suspend(currentUserProvider.requireUserId(), UserId.of(accountId), request.days()));
    }

    @PostMapping("/{accountId}/ban")
    @PreAuthorize("hasAuthority('USER_MANAGE')")
    @Operation(summary = "Keep an account out until reinstated; its sessions end")
    public ResponseEntity<ApiResponse<AdminAccountDto>> ban(@PathVariable String accountId) {
        return ok(administration.ban(currentUserProvider.requireUserId(), UserId.of(accountId)));
    }

    @PostMapping("/{accountId}/reinstate")
    @PreAuthorize("hasAuthority('USER_MANAGE')")
    @Operation(summary = "Let a suspended or banned account back in")
    public ResponseEntity<ApiResponse<AdminAccountDto>> reinstate(@PathVariable String accountId) {
        return ok(administration.reinstate(currentUserProvider.requireUserId(), UserId.of(accountId)));
    }

    private static ResponseEntity<ApiResponse<AdminAccountDto>> ok(com.readora.domain.identity.UserAccount account) {
        return ResponseEntity.ok(ApiResponse.ok(AdminAccountDto.fromDomain(account)));
    }
}
