package com.readora.web.dto;

import com.readora.domain.identity.Permission;
import com.readora.domain.identity.Subscription;

import java.time.Instant;
import java.util.List;

public record SubscriptionDto(
        String plan,
        String status,
        boolean active,
        Instant currentPeriodEnd,
        boolean cancelAtPeriodEnd,
        List<String> planPermissions
) {
    public static SubscriptionDto fromDomain(Subscription subscription) {
        return new SubscriptionDto(
                subscription.getPlan().name(),
                subscription.getStatus().name(),
                subscription.isActive(Instant.now()),
                subscription.getCurrentPeriodEnd(),
                subscription.isCancelAtPeriodEnd(),
                subscription.getPlan().permissions().stream().map(Permission::name).sorted().toList()
        );
    }
}
