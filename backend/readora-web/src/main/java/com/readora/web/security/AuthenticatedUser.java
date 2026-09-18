package com.readora.web.security;

import com.readora.domain.identity.Permission;
import com.readora.domain.common.UserId;

import java.util.Set;

public record AuthenticatedUser(UserId userId, String username, Set<Permission> permissions) {
    public boolean can(Permission permission) {
        return permissions.contains(permission);
    }
}
