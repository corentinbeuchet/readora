package com.readora.domain.identity;

public enum Permission {
    COMMENT_WRITE,
    COMMENT_UPVOTE,
    USER_MANAGE,
    /// Personal library, reading history, read markers and bookmarks (free for every signed-in reader).
    LIBRARY_USE,
    /// Report a page that doesn't display (US-06).
    PAGE_REPORT,
    /// Rate and review series (US-09).
    RATE_WORK,
    /// Report a comment to the moderators (US-11).
    COMMENT_REPORT,
    /// See the report queue, hide comments, dismiss reports (US-11).
    COMMENT_MODERATE
}
