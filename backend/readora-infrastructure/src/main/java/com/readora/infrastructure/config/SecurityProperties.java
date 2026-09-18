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
            String secret,
            @DefaultValue("readora") String issuer,
            @DefaultValue("PT15M") Duration accessTtl,
            @DefaultValue("P30D") Duration refreshTtl
    ) {
        public Jwt {
            if (secret == null || secret.isBlank()) {
                throw new IllegalStateException("readora.security.jwt.secret must be set (READORA_JWT_SECRET)");
            }
        }

        @Override
        public String toString() {
            return "Jwt[secret=****, issuer=" + issuer + ", accessTtl=" + accessTtl + ", refreshTtl=" + refreshTtl + "]";
        }
    }
}
