package com.readora.application.port.out;

import com.readora.domain.common.UserId;
import com.readora.domain.identity.PasswordResetToken;

import java.util.Optional;

public interface PasswordResetTokenRepositoryPort {
    PasswordResetToken save(PasswordResetToken token);

    Optional<PasswordResetToken> findByTokenHash(String tokenHash);

    /// A new link replaces the older ones: only the latest email works.
    void deleteAllForUser(UserId userId);
}
