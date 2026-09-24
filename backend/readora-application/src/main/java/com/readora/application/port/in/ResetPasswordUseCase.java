package com.readora.application.port.in;

/// Choosing a new password after forgetting it (US-15): a link by email, then the new password.
public interface ResetPasswordUseCase {

    /// The language of the site the reader asked from: the email and its link speak it.
    enum SiteLanguage {
        ENGLISH(""),
        FRENCH("/fr");

        private final String pathPrefix;

        SiteLanguage(String pathPrefix) {
            this.pathPrefix = pathPrefix;
        }

        public String pathPrefix() {
            return pathPrefix;
        }
    }

    /// Emails a reset link when an account uses `email`; does nothing otherwise, and the caller cannot tell which.
    void requestReset(String email, SiteLanguage language);

    /// Sets the new password and ends every session of the account.
    ///
    /// @throws com.readora.domain.common.DomainValidationException `RESET_LINK_INVALID` if the link is unknown, used
    ///         or expired; `VALIDATION_FAILED` if the password is too short
    void resetPassword(String rawToken, String newPassword);
}
