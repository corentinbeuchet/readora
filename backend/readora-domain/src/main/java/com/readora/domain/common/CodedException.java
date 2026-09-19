package com.readora.domain.common;

/// A failure reported to API clients with a stable code from [ErrorCodes]; the web layer copies it into the error
/// response, and the exception message stays English for logs.
public interface CodedException {

    String code();
}
