package com.readora.domain.identity;

import com.readora.domain.common.CodedException;
import com.readora.domain.common.ErrorCodes;

/// Registration with an email or username that another account already uses. Mapped to HTTP 409.
public class EmailAlreadyUsedException extends RuntimeException implements CodedException {
    private final String code;

    private EmailAlreadyUsedException(String code, String message) {
        super(message);
        this.code = code;
    }

    public static EmailAlreadyUsedException emailTaken(Email email) {
        return new EmailAlreadyUsedException(ErrorCodes.EMAIL_TAKEN, "Email already registered: " + email);
    }

    public static EmailAlreadyUsedException usernameTaken(String username) {
        return new EmailAlreadyUsedException(ErrorCodes.USERNAME_TAKEN, "Username already taken: " + username);
    }

    @Override
    public String code() {
        return code;
    }
}
