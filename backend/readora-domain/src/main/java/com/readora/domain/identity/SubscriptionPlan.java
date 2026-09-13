package com.readora.domain.identity;

import java.util.Collections;
import java.util.EnumSet;
import java.util.Set;

public enum SubscriptionPlan {
    FREE(EnumSet.noneOf(Permission.class)),
    PREMIUM(EnumSet.of(Permission.BOOKMARK_READ, Permission.BOOKMARK_WRITE));

    private final Set<Permission> permissions;

    SubscriptionPlan(Set<Permission> permissions) {
        this.permissions = Collections.unmodifiableSet(permissions);
    }

    public Set<Permission> permissions() {
        return permissions;
    }
}
