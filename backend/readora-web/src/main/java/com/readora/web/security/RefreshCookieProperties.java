package com.readora.web.security;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/// Refresh-token cookie settings (under `readora.security`, next to the token settings the infrastructure reads).
@ConfigurationProperties(prefix = "readora.security")
public record RefreshCookieProperties(
        @DefaultValue("readora_refresh") String refreshCookieName,
        @DefaultValue("false") boolean cookieSecure
) {}
