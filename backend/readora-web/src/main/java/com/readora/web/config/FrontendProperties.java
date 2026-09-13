package com.readora.web.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

@ConfigurationProperties(prefix = "readora.frontend")
public record FrontendProperties(
        @DefaultValue("http://localhost:4200") String baseUrl
) {
    public String url(String path) {
        String base = baseUrl.endsWith("/") ? baseUrl.substring(0, baseUrl.length() - 1) : baseUrl;
        return base + (path.startsWith("/") ? path : "/" + path);
    }
}
