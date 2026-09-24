package com.readora.application.port.in;

import com.readora.application.export.ReaderData;
import com.readora.domain.common.UserId;
import org.jspecify.annotations.Nullable;

import java.time.Instant;
import java.util.List;

/// Downloading everything Readora keeps about me (US-15).
public interface ExportMyDataUseCase {

    /// The account (without its password) and what the reader has on Readora.
    record AccountExport(String username, String email, String displayName, String bio, @Nullable String avatarUrl, List<String> roles,
                         Instant createdAt, Instant exportedAt, ReaderData data) {
        public AccountExport {
            roles = List.copyOf(roles);
        }
    }

    /// @throws com.readora.domain.common.NotFoundException if the account no longer exists
    AccountExport export(UserId userId);
}
