package com.readora.infrastructure.security;

import com.readora.infrastructure.config.SecurityProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;

/// Verifies the access tokens issued by [JwtTokenProviderAdapter] with the same key and issuer.
@Configuration
public class JwtDecoderConfig {

    @Bean
    public JwtDecoder jwtDecoder(SecurityProperties securityProperties) {
        NimbusJwtDecoder decoder = NimbusJwtDecoder.withSecretKey(JwtTokenProviderAdapter.secretKey(securityProperties.jwt().secret()))
                .macAlgorithm(MacAlgorithm.HS256)
                .build();
        // Signature alone is not enough: expiry/not-before (default validators) and our issuer must match too.
        decoder.setJwtValidator(JwtValidators.createDefaultWithIssuer(securityProperties.jwt().issuer()));
        return decoder;
    }
}
