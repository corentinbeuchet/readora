package com.readora.domain.identity;

import java.util.Collections;
import java.util.EnumSet;
import java.util.Set;

public enum Role {
    READER(EnumSet.of(Permission.COMMENT_WRITE, Permission.COMMENT_UPVOTE)),
    SCANLATOR(EnumSet.of(
            Permission.COMMENT_WRITE,
            Permission.COMMENT_UPVOTE,
            Permission.PROJECT_VIEW,
            Permission.TASK_CLAIM,
            Permission.TASK_SUBMIT,
            Permission.CHAPTER_PUBLISH
    )),
    ADMIN(EnumSet.allOf(Permission.class));

    private final Set<Permission> permissions;

    Role(Set<Permission> permissions) {
        this.permissions = Collections.unmodifiableSet(permissions);
    }

    public Set<Permission> permissions() {
        return permissions;
    }
}
