package com.readora.domain.common;

/// Stable error codes the API returns next to its English message (`ApiResponse.code`), so clients can show the
/// error in the reader's language (US-13). A code never changes once published; the frontend keeps the matching
/// translations in `core/api/error-messages.ts`.
public final class ErrorCodes {

    // Generic, one per kind of failure (set by the exception type or the web layer).
    public static final String VALIDATION_FAILED = "VALIDATION_FAILED";
    public static final String MALFORMED_REQUEST = "MALFORMED_REQUEST";
    public static final String NOT_FOUND = "NOT_FOUND";
    public static final String UNAUTHENTICATED = "UNAUTHENTICATED";
    public static final String INVALID_CREDENTIALS = "INVALID_CREDENTIALS";
    public static final String SESSION_EXPIRED = "SESSION_EXPIRED";
    public static final String FORBIDDEN = "FORBIDDEN";
    public static final String CONFLICT = "CONFLICT";
    public static final String RATE_LIMITED = "RATE_LIMITED";
    public static final String METHOD_NOT_ALLOWED = "METHOD_NOT_ALLOWED";
    public static final String UNSUPPORTED_MEDIA_TYPE = "UNSUPPORTED_MEDIA_TYPE";
    public static final String FILE_TOO_LARGE = "FILE_TOO_LARGE";
    public static final String STORAGE_UNAVAILABLE = "STORAGE_UNAVAILABLE";
    public static final String PAYMENT_FAILED = "PAYMENT_FAILED";
    public static final String WEBHOOK_REJECTED = "WEBHOOK_REJECTED";
    public static final String INTERNAL_ERROR = "INTERNAL_ERROR";

    // Specific rule violations a reader can hit through the interface.
    public static final String EMAIL_TAKEN = "EMAIL_TAKEN";
    public static final String USERNAME_TAKEN = "USERNAME_TAKEN";
    public static final String TASK_ALREADY_CLAIMED = "TASK_ALREADY_CLAIMED";
    public static final String TASK_CLAIMED_BY_OTHER = "TASK_CLAIMED_BY_OTHER";
    public static final String TASK_ALREADY_EXISTS = "TASK_ALREADY_EXISTS";
    public static final String OWN_CONTENT = "OWN_CONTENT";
    public static final String LIST_DUPLICATE_SERIES = "LIST_DUPLICATE_SERIES";
    public static final String ALREADY_HANDLED = "ALREADY_HANDLED";
    public static final String NO_ACTIVE_SUBSCRIPTION = "NO_ACTIVE_SUBSCRIPTION";
    public static final String CANCELLATION_ALREADY_SCHEDULED = "CANCELLATION_ALREADY_SCHEDULED";
    public static final String UNSUPPORTED_FILE_FORMAT = "UNSUPPORTED_FILE_FORMAT";
    public static final String EMPTY_FILE = "EMPTY_FILE";
    public static final String CHAPTER_NOT_PUBLISHED = "CHAPTER_NOT_PUBLISHED";
    public static final String TEAM_NAME_TAKEN = "TEAM_NAME_TAKEN";
    public static final String SERIES_ALREADY_IN_TEAM = "SERIES_ALREADY_IN_TEAM";
    public static final String LAST_LEADER = "LAST_LEADER";
    public static final String TEAM_NOT_ON_SERIES = "TEAM_NOT_ON_SERIES";
    public static final String CHAPTER_ALREADY_EXISTS = "CHAPTER_ALREADY_EXISTS";

    private ErrorCodes() {
    }
}
