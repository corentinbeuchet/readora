package com.readora.application.port.out;

import com.readora.domain.identity.PasswordHash;

public interface PasswordHasherPort {
    PasswordHash hash(String rawPassword);
    boolean matches(String rawPassword, PasswordHash hash);
}
