package com.readora.domain.identity;

import java.util.Collections;
import java.util.EnumSet;
import java.util.Set;

public enum Role {
    READER(EnumSet.of(Permission.COMMENT_WRITE, Permission.COMMENT_UPVOTE, Permission.LIBRARY_USE, Permission.PAGE_REPORT,
            Permission.RATE_WORK)),
    SCANLATOR(EnumSet.of(
            Permission.COMMENT_WRITE,
            Permission.COMMENT_UPVOTE,
            Permission.LIBRARY_USE,
            Permission.PAGE_REPORT,
            Permission.RATE_WORK,
            Permission.PROJECT_VIEW,
            Permission.TASK_CLAIM,
            Permission.TASK_SUBMIT,
            Permission.CHAPTER_PUBLISH,
            Permission.WORK_CREATE
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
