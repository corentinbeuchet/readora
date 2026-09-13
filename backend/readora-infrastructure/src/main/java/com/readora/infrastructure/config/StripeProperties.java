package com.readora.infrastructure.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

@ConfigurationProperties(prefix = "readora.stripe")
public record StripeProperties(
        @DefaultValue("") String secretKey,
        @DefaultValue("") String webhookSecret,
        @DefaultValue("") String premiumPriceId
) {
    public boolean isConfigured() {
        return !secretKey.isBlank() && !premiumPriceId.isBlank();
    }
}
