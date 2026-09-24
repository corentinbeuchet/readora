package com.readora.web.dto;

import com.readora.domain.identity.UserAccount;
import org.jspecify.annotations.Nullable;

import java.time.Instant;
import java.util.List;

/// An account as an admin sees it (US-16): who it is, what it may do, whether it is kept out.
///
/// @param suspendedUntil set while `standing` is `SUSPENDED`
public record AdminAccountDto(String id, String username, String email, String displayName, List<String> roles, String standing,
                              @Nullable Instant suspendedUntil, Instant createdAt) {
    public static AdminAccountDto fromDomain(UserAccount account) {
        return new AdminAccountDto(account.getId().value(), account.getUsername(), account.getEmail().value(), account.getDisplayName(),
                account.getRoles().stream().map(Enum::name).sorted().toList(), account.getStanding().name(), account.getSuspendedUntil(),
                account.getCreatedAt());
    }
}
