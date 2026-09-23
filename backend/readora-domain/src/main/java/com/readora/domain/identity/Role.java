package com.readora.domain.identity;

import java.util.Collections;
import java.util.EnumSet;
import java.util.Set;

public enum Role {
    READER(EnumSet.of(Permission.COMMENT_WRITE, Permission.COMMENT_UPVOTE, Permission.LIBRARY_USE, Permission.PAGE_REPORT,
            Permission.RATE_WORK, Permission.COMMENT_REPORT)),
    /// A reader who also looks after discussions (US-11).
    MODERATOR(EnumSet.of(Permission.COMMENT_WRITE, Permission.COMMENT_UPVOTE, Permission.LIBRARY_USE, Permission.PAGE_REPORT,
            Permission.RATE_WORK, Permission.COMMENT_REPORT, Permission.COMMENT_MODERATE)),
    ADMIN(EnumSet.allOf(Permission.class));

    private final Set<Permission> permissions;

    Role(Set<Permission> permissions) {
        this.permissions = Collections.unmodifiableSet(permissions);
    }

    public Set<Permission> permissions() {
        return permissions;
    }
}
