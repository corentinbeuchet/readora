package com.readora.application.service;

import com.readora.application.port.in.ResetPasswordUseCase;
import com.readora.application.port.out.MailPort;
import com.readora.application.port.out.PasswordHasherPort;
import com.readora.application.port.out.PasswordResetTokenRepositoryPort;
import com.readora.application.port.out.RefreshTokenRepositoryPort;
import com.readora.application.port.out.TokenProviderPort;
import com.readora.application.port.out.UserAccountRepositoryPort;
import com.readora.domain.common.DomainValidationException;
import com.readora.domain.common.ErrorCodes;
import com.readora.domain.identity.Email;
import com.readora.domain.identity.PasswordResetToken;
import com.readora.domain.identity.UserAccount;

import java.time.Clock;
import java.time.Instant;
import java.util.Objects;
import java.util.Optional;

public class PasswordResetService implements ResetPasswordUseCase {

    private final UserAccountRepositoryPort users;
    private final PasswordResetTokenRepositoryPort resetTokens;
    private final RefreshTokenRepositoryPort refreshTokens;
    private final TokenProviderPort tokens;
    private final PasswordHasherPort passwordHasher;
    private final MailPort mail;
    private final Clock clock;
    /// Where readers open the site (`https://readora.com`): the link points there.
    private final String siteUrl;

    public PasswordResetService(UserAccountRepositoryPort users, PasswordResetTokenRepositoryPort resetTokens,
                                RefreshTokenRepositoryPort refreshTokens, TokenProviderPort tokens, PasswordHasherPort passwordHasher,
                                MailPort mail, Clock clock, String siteUrl) {
        this.users = Objects.requireNonNull(users, "UserAccountRepositoryPort cannot be null");
        this.resetTokens = Objects.requireNonNull(resetTokens, "PasswordResetTokenRepositoryPort cannot be null");
        this.refreshTokens = Objects.requireNonNull(refreshTokens, "RefreshTokenRepositoryPort cannot be null");
        this.tokens = Objects.requireNonNull(tokens, "TokenProviderPort cannot be null");
        this.passwordHasher = Objects.requireNonNull(passwordHasher, "PasswordHasherPort cannot be null");
        this.mail = Objects.requireNonNull(mail, "MailPort cannot be null");
        this.clock = Objects.requireNonNull(clock, "Clock cannot be null");
        this.siteUrl = Objects.requireNonNull(siteUrl, "Site URL cannot be null").replaceAll("/+$", "");
    }

    @Override
    public void requestReset(String rawEmail, SiteLanguage language) {
        Optional<UserAccount> account;
        try {
            account = users.findByEmail(Email.of(rawEmail));
        } catch (DomainValidationException e) {
            // Not an email address: no account can use it.
            return;
        }
        account.ifPresent(owner -> {
            // Same kind of secret as a refresh token: random, and only its SHA-256 is stored.
            String raw = tokens.generateRefreshToken();
            resetTokens.deleteAllForUser(owner.getId());
            resetTokens.save(PasswordResetToken.issue(owner.getId(), tokens.hashRefreshToken(raw), clock.instant()));
            mail.send(resetEmail(owner, language, siteUrl + language.pathPrefix() + "/reset-password?token=" + raw));
        });
    }

    @Override
    public void resetPassword(String rawToken, String newPassword) {
        Instant now = clock.instant();
        PasswordResetToken token = Optional.ofNullable(rawToken).filter(raw -> !raw.isBlank())
                .flatMap(raw -> resetTokens.findByTokenHash(tokens.hashRefreshToken(raw)))
                .filter(found -> found.isUsable(now))
                .orElseThrow(() -> DomainValidationException.withCode(ErrorCodes.RESET_LINK_INVALID,
                        "This reset link is unknown, already used or expired"));
        AuthenticationService.validatePassword(newPassword);
        UserAccount account = users.findById(token.getUserId()).orElseThrow(() -> DomainValidationException.withCode(
                ErrorCodes.RESET_LINK_INVALID, "The account of this reset link no longer exists"));
        account.changePassword(passwordHasher.hash(newPassword));
        users.save(account);
        token.use(now);
        resetTokens.save(token);
        // Whoever knew the old password is signed out (deleted, not revoked: see RefreshTokenRepositoryPort).
        refreshTokens.deleteAllForUser(account.getId());
    }

    private static MailPort.Email resetEmail(UserAccount owner, SiteLanguage language, String link) {
        return switch (language) {
            case ENGLISH -> new MailPort.Email(owner.getEmail().value(), "Choose a new Readora password", """
                    Hello %s,

                    Someone, hopefully you, asked to choose a new password for your Readora account.
                    Open this link within 30 minutes to choose it:

                    %s

                    If it wasn't you, ignore this email: your password stays the same.
                    """.formatted(owner.getUsername(), link));
            case FRENCH -> new MailPort.Email(owner.getEmail().value(), "Choisissez un nouveau mot de passe Readora", """
                    Bonjour %s,

                    Quelqu'un, vous sans doute, a demandé à choisir un nouveau mot de passe pour votre compte Readora.
                    Ouvrez ce lien dans les 30 minutes pour le choisir :

                    %s

                    Si ce n'était pas vous, ignorez ce message : votre mot de passe ne change pas.
                    """.formatted(owner.getUsername(), link));
        };
    }
}
