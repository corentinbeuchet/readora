package com.readora.infrastructure.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

import java.time.Duration;

@ConfigurationProperties(prefix = "readora.security")
public record SecurityProperties(
        @DefaultValue Jwt jwt,
        @DefaultValue("readora_refresh") String refreshCookieName,
        @DefaultValue("false") boolean cookieSecure
) {
    public record Jwt(
            @DefaultValue("change-me-please-use-a-256-bit-secret-from-READORA_JWT_SECRET") String secret,
            @DefaultValue("readora") String issuer,
            @DefaultValue("PT15M") Duration accessTtl,
            @DefaultValue("P30D") Duration refreshTtl
    ) {}
}
