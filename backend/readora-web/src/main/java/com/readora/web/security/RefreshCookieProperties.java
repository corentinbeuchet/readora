package com.readora.web.security;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/// Refresh-token cookie settings (same `readora.security` keys the infrastructure uses for tokens).
@ConfigurationProperties(prefix = "readora.security")
public record RefreshCookieProperties(
        @DefaultValue("readora_refresh") String refreshCookieName,
        @DefaultValue("false") boolean cookieSecure
) {}
