package com.readora.web.security;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

import java.util.List;

@ConfigurationProperties(prefix = "readora.cors")
public record CorsProperties(
        @DefaultValue({"http://localhost:4200", "http://localhost:4201"}) List<String> allowedOrigins
) {}
