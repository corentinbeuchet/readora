package com.readora.web.dto;

import com.readora.domain.identity.Permission;
import com.readora.domain.identity.Role;
import com.readora.domain.identity.UserAccount;
import org.jspecify.annotations.Nullable;

import java.time.Instant;
import java.util.List;

public record UserProfileDto(
        String id,
        String email,
        String username,
        String displayName,
        String bio,
        @Nullable String avatarUrl,
        List<String> roles,
        List<String> permissions,
        Instant createdAt
) {
    public static UserProfileDto fromDomain(UserAccount account) {
        return new UserProfileDto(
                account.getId().value(),
                account.getEmail().value(),
                account.getUsername(),
                account.getDisplayName(),
                account.getBio(),
                account.getAvatarUrl(),
                account.getRoles().stream().map(Role::name).sorted().toList(),
                account.effectivePermissions().stream().map(Permission::name).sorted().toList(),
                account.getCreatedAt()
        );
    }
}
