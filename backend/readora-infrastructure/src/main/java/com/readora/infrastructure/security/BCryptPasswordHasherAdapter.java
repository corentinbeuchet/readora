package com.readora.infrastructure.security;

import com.readora.application.port.out.PasswordHasherPort;
import com.readora.domain.common.DomainValidationException;
import com.readora.domain.identity.PasswordHash;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;

@Component
public class BCryptPasswordHasherAdapter implements PasswordHasherPort {

    /// BCrypt only reads the first 72 bytes; longer (e.g. multi-byte) passwords are rejected instead of truncated.
    private static final int BCRYPT_MAX_BYTES = 72;

    private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();

    @Override
    public PasswordHash hash(String rawPassword) {
        if (rawPassword != null && rawPassword.getBytes(StandardCharsets.UTF_8).length > BCRYPT_MAX_BYTES) {
            throw new DomainValidationException("Password is too long (max 72 bytes)");
        }
        return PasswordHash.of(encoder.encode(rawPassword));
    }

    @Override
    public boolean matches(String rawPassword, PasswordHash hash) {
        return rawPassword != null && hash != null && encoder.matches(rawPassword, hash.value());
    }
}
