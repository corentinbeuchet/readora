package com.readora.infrastructure.security;

import com.readora.application.port.out.PasswordHasherPort;
import com.readora.domain.identity.PasswordHash;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Component;

@Component
public class BCryptPasswordHasherAdapter implements PasswordHasherPort {

    private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();

    @Override
    public PasswordHash hash(String rawPassword) {
        return PasswordHash.of(encoder.encode(rawPassword));
    }

    @Override
    public boolean matches(String rawPassword, PasswordHash hash) {
        return rawPassword != null && hash != null && encoder.matches(rawPassword, hash.value());
    }
}
