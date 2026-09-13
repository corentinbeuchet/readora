package com.readora.web.controller;

import com.readora.application.port.in.ManageSubscriptionUseCase;
import com.readora.application.port.out.PaymentPort;
import com.readora.domain.common.DomainValidationException;
import com.readora.domain.identity.Subscription;
import com.readora.domain.identity.SubscriptionPlan;
import com.readora.web.config.FrontendProperties;
import com.readora.web.dto.ApiResponse;
import com.readora.web.dto.CheckoutRequest;
import com.readora.web.dto.CheckoutSessionDto;
import com.readora.web.dto.SubscriptionDto;
import com.readora.web.security.CurrentUserProvider;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Locale;

@RestController
@RequestMapping("/api/v1/subscriptions")
@EnableConfigurationProperties(FrontendProperties.class)
@Tag(name = "Subscriptions", description = "Premium plan checkout, status and Stripe webhooks")
public class SubscriptionController {

    static final String SUCCESS_PATH = "/subscription/success?session_id={CHECKOUT_SESSION_ID}";
    static final String CANCEL_PATH = "/subscription/cancel";

    private final ManageSubscriptionUseCase manageSubscriptionUseCase;
    private final PaymentPort paymentPort;
    private final CurrentUserProvider currentUserProvider;
    private final FrontendProperties frontendProperties;

    public SubscriptionController(ManageSubscriptionUseCase manageSubscriptionUseCase,
                                  PaymentPort paymentPort,
                                  CurrentUserProvider currentUserProvider,
                                  FrontendProperties frontendProperties) {
        this.manageSubscriptionUseCase = manageSubscriptionUseCase;
        this.paymentPort = paymentPort;
        this.currentUserProvider = currentUserProvider;
        this.frontendProperties = frontendProperties;
    }

    @GetMapping("/me")
    @Operation(summary = "Get my current subscription")
    public ResponseEntity<ApiResponse<SubscriptionDto>> getCurrent() {
        Subscription subscription = manageSubscriptionUseCase.getCurrent(currentUserProvider.requireUserId());
        return ResponseEntity.ok(ApiResponse.ok(SubscriptionDto.fromDomain(subscription)));
    }

    @PostMapping("/checkout")
    @Operation(summary = "Start a Stripe Checkout session for a paid plan")
    public ResponseEntity<ApiResponse<CheckoutSessionDto>> startCheckout(@Valid @RequestBody CheckoutRequest request) {
        SubscriptionPlan plan = parsePlan(request.plan());
        PaymentPort.CheckoutSession session = manageSubscriptionUseCase.startCheckout(
                currentUserProvider.requireUserId(),
                plan,
                frontendProperties.url(SUCCESS_PATH),
                frontendProperties.url(CANCEL_PATH)
        );
        return ResponseEntity.ok(ApiResponse.ok(CheckoutSessionDto.from(session)));
    }

    @PostMapping("/cancel")
    @Operation(summary = "Cancel my active subscription")
    public ResponseEntity<ApiResponse<SubscriptionDto>> cancel() {
        Subscription subscription = manageSubscriptionUseCase.cancel(currentUserProvider.requireUserId());
        return ResponseEntity.ok(ApiResponse.ok(SubscriptionDto.fromDomain(subscription)));
    }

    @PostMapping("/stripe/webhook")
    @Operation(summary = "Stripe webhook endpoint (signature verified)")
    public ResponseEntity<ApiResponse<String>> stripeWebhook(
            @RequestBody String payload,
            @RequestHeader(name = "Stripe-Signature", required = false) String signature
    ) {
        if (signature == null || signature.isBlank()) {
            throw new PaymentPort.WebhookVerificationException("Missing Stripe-Signature header", null);
        }
        PaymentPort.PaymentEvent event = paymentPort.parseWebhook(payload, signature);
        manageSubscriptionUseCase.handlePaymentEvent(event);
        return ResponseEntity.ok(ApiResponse.ok("received"));
    }

    private static SubscriptionPlan parsePlan(String raw) {
        try {
            return SubscriptionPlan.valueOf(raw.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw new DomainValidationException("Unknown subscription plan: " + raw);
        }
    }
}
