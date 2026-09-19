package com.readora.domain.common;

public class DomainValidationException extends RuntimeException implements CodedException {
    private final String code;

    public DomainValidationException(String message) {
        this(ErrorCodes.VALIDATION_FAILED, message);
    }

    public DomainValidationException(String message, Throwable cause) {
        super(message, cause);
        this.code = ErrorCodes.VALIDATION_FAILED;
    }

    private DomainValidationException(String code, String message) {
        super(message);
        this.code = code;
    }

    /// A rule a reader can break through the interface, with its own [ErrorCodes] code so the client can explain it
    /// in the reader's language. Backstop checks (lengths the forms already enforce) keep the generic code.
    public static DomainValidationException withCode(String code, String message) {
        return new DomainValidationException(code, message);
    }

    @Override
    public String code() {
        return code;
    }
}
