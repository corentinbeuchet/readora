package com.readora.infrastructure.security;

import com.nimbusds.jose.jwk.source.ImmutableSecret;
import com.readora.application.port.out.TokenProviderPort;
import com.readora.domain.identity.Permission;
import com.readora.domain.identity.UserAccount;
import com.readora.infrastructure.config.SecurityProperties;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;

@Component
public class JwtTokenProviderAdapter implements TokenProviderPort {

    public static final String CLAIM_USERNAME = "username";
    public static final String CLAIM_PERMISSIONS = "permissions";
    private static final int REFRESH_TOKEN_BYTES = 48;

    private final SecurityProperties properties;
    private final JwtEncoder jwtEncoder;
    private final SecureRandom secureRandom = new SecureRandom();

    public JwtTokenProviderAdapter(SecurityProperties properties) {
        this.properties = properties;
        this.jwtEncoder = new NimbusJwtEncoder(new ImmutableSecret<>(secretKey(properties.jwt().secret())));
    }

    public static SecretKey secretKey(String secret) {
        byte[] bytes = secret.getBytes(StandardCharsets.UTF_8);
        if (bytes.length < 32) {
            throw new IllegalStateException("readora.security.jwt.secret must be at least 32 bytes (256 bits) for HS256");
        }
        return new SecretKeySpec(bytes, "HmacSHA256");
    }

    @Override
    public AccessToken issueAccessToken(UserAccount account) {
        Instant now = Instant.now();
        Instant expiresAt = now.plus(properties.jwt().accessTtl());
        List<String> permissions = account.effectivePermissions().stream().map(Permission::name).sorted().toList();

        JwtClaimsSet claims = JwtClaimsSet.builder()
                .issuer(properties.jwt().issuer())
                .issuedAt(now)
                .expiresAt(expiresAt)
                .subject(account.getId().value())
                .claim(CLAIM_USERNAME, account.getUsername())
                .claim(CLAIM_PERMISSIONS, permissions)
                .build();

        JwsHeader header = JwsHeader.with(MacAlgorithm.HS256).build();
        String token = jwtEncoder.encode(JwtEncoderParameters.from(header, claims)).getTokenValue();
        return new AccessToken(token, expiresAt);
    }

    @Override
    public String generateRefreshToken() {
        byte[] bytes = new byte[REFRESH_TOKEN_BYTES];
        secureRandom.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    @Override
    public String hashRefreshToken(String rawRefreshToken) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(rawRefreshToken.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 not available", e);
        }
    }

    @Override
    public Duration refreshTokenTtl() {
        return properties.jwt().refreshTtl();
    }
}
