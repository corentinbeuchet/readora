package com.readora.web.controller;

import com.readora.application.port.in.ManageSubscriptionUseCase;
import com.readora.domain.identity.Subscription;
import com.readora.web.dto.ApiResponse;
import com.readora.web.dto.SubscriptionDto;
import com.readora.web.security.CurrentUserProvider;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/// The signed-in reader's plan. Checkout, cancellation and payment webhooks were removed with the payment provider
/// (2026-09-23) and come back with a payments feature.
@RestController
@RequestMapping("/api/v1/subscriptions")
@Tag(name = "Subscriptions", description = "The reader's plan (Free or Premium)")
public class SubscriptionController {

    private final ManageSubscriptionUseCase manageSubscriptionUseCase;
    private final CurrentUserProvider currentUserProvider;

    public SubscriptionController(ManageSubscriptionUseCase manageSubscriptionUseCase, CurrentUserProvider currentUserProvider) {
        this.manageSubscriptionUseCase = manageSubscriptionUseCase;
        this.currentUserProvider = currentUserProvider;
    }

    @GetMapping("/me")
    @Operation(summary = "Get my current subscription")
    public ResponseEntity<ApiResponse<SubscriptionDto>> getCurrent() {
        Subscription subscription = manageSubscriptionUseCase.getCurrent(currentUserProvider.requireUserId());
        return ResponseEntity.ok(ApiResponse.ok(SubscriptionDto.fromDomain(subscription)));
    }
}
