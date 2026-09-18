package com.readora.infrastructure.config;

import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Locale;

/// Fails startup when the `production` profile runs with a development or placeholder JWT secret.
/// The dev default in `application.yml` keeps local runs working; it must never reach production.
///
/// @see SecurityProperties.Jwt
@Component
public class ProductionSecretsGuard {

    static final String PRODUCTION_PROFILE = "production";
    private static final List<String> PLACEHOLDER_MARKERS = List.of("dev-only", "test-only", "change-me", "local-compose");

    public ProductionSecretsGuard(Environment environment, SecurityProperties securityProperties) {
        if (!environment.acceptsProfiles(Profiles.of(PRODUCTION_PROFILE))) {
            return;
        }
        String secret = securityProperties.jwt().secret().toLowerCase(Locale.ROOT);
        if (PLACEHOLDER_MARKERS.stream().anyMatch(secret::contains)) {
            throw new IllegalStateException(
                    "readora.security.jwt.secret is a development placeholder; set READORA_JWT_SECRET for the production profile");
        }
    }
}
