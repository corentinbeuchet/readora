package com.readora.application.service;

import com.readora.application.port.in.AuthenticateUserUseCase;
import com.readora.application.port.out.PasswordHasherPort;
import com.readora.application.port.out.RefreshTokenRepositoryPort;
import com.readora.application.port.out.TokenProviderPort;
import com.readora.application.port.out.UserAccountRepositoryPort;
import com.readora.domain.common.AccessDeniedDomainException;
import com.readora.domain.common.DomainValidationException;
import com.readora.domain.common.ErrorCodes;
import com.readora.domain.common.NotFoundException;
import com.readora.domain.common.UserId;
import com.readora.domain.identity.Email;
import com.readora.domain.identity.EmailAlreadyUsedException;
import com.readora.domain.identity.InvalidCredentialsException;
import com.readora.domain.identity.PasswordHash;
import com.readora.domain.identity.RefreshToken;
import com.readora.domain.identity.UserAccount;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Objects;
import java.util.Optional;

public class AuthenticationService implements AuthenticateUserUseCase {
    private static final Logger log = LoggerFactory.getLogger(AuthenticationService.class);

    public static final int PASSWORD_MIN_LENGTH = 8;

    private final UserAccountRepositoryPort userRepository;
    private final RefreshTokenRepositoryPort refreshTokenRepository;
    private final PasswordHasherPort passwordHasher;
    private final TokenProviderPort tokenProvider;
    private final Duration refreshReuseGrace;
    /// Compared against when the email is unknown, so a failed login costs the same time either way.
    private final PasswordHash timingDummyHash;
    private final Clock clock;

    public AuthenticationService(UserAccountRepositoryPort userRepository,
                                 RefreshTokenRepositoryPort refreshTokenRepository,
                                 PasswordHasherPort passwordHasher,
                                 TokenProviderPort tokenProvider) {
        this(userRepository, refreshTokenRepository, passwordHasher, tokenProvider, Duration.ofSeconds(30));
    }

    /// @param refreshReuseGrace a revoked refresh token presented again *later* than this after its revocation is
    ///                          treated as theft and revokes every session of its owner; within the grace period
    ///                          (e.g. two tabs refreshing at once) it is only rejected
    public AuthenticationService(UserAccountRepositoryPort userRepository,
                                 RefreshTokenRepositoryPort refreshTokenRepository,
                                 PasswordHasherPort passwordHasher,
                                 TokenProviderPort tokenProvider,
                                 Duration refreshReuseGrace) {
        this(userRepository, refreshTokenRepository, passwordHasher, tokenProvider, refreshReuseGrace, Clock.systemUTC());
    }

    public AuthenticationService(UserAccountRepositoryPort userRepository,
                                 RefreshTokenRepositoryPort refreshTokenRepository,
                                 PasswordHasherPort passwordHasher,
                                 TokenProviderPort tokenProvider,
                                 Duration refreshReuseGrace,
                                 Clock clock) {
        this.clock = Objects.requireNonNull(clock, "Clock cannot be null");
        this.refreshReuseGrace = Objects.requireNonNull(refreshReuseGrace, "Refresh reuse grace cannot be null");
        this.userRepository = Objects.requireNonNull(userRepository, "UserAccountRepositoryPort cannot be null");
        this.refreshTokenRepository = Objects.requireNonNull(refreshTokenRepository, "RefreshTokenRepositoryPort cannot be null");
        this.passwordHasher = Objects.requireNonNull(passwordHasher, "PasswordHasherPort cannot be null");
        this.tokenProvider = Objects.requireNonNull(tokenProvider, "TokenProviderPort cannot be null");
        this.timingDummyHash = passwordHasher.hash("readora-timing-equaliser");
    }

    @Override
    public AuthResult register(String rawEmail, String username, String rawPassword) {
        Email email = Email.of(rawEmail);
        validatePassword(rawPassword);
        if (userRepository.existsByEmail(email)) {
            throw EmailAlreadyUsedException.emailTaken(email);
        }
        if (userRepository.existsByUsername(username)) {
            throw EmailAlreadyUsedException.usernameTaken(username);
        }

        UserAccount account = UserAccount.register(email, username, passwordHasher.hash(rawPassword));
        UserAccount saved = userRepository.save(account);
        return issueTokens(saved);
    }

    @Override
    public AuthResult login(String rawEmail, String rawPassword) {
        Email email;
        try {
            email = Email.of(rawEmail);
        } catch (DomainValidationException e) {
            throw new InvalidCredentialsException("Invalid email or password");
        }
        Optional<UserAccount> maybeAccount = userRepository.findByEmail(email);
        // Always run one hash comparison so response time does not reveal whether the email is registered.
        PasswordHash expected = maybeAccount.map(UserAccount::getPasswordHash).orElse(timingDummyHash);
        boolean passwordMatches = rawPassword != null && passwordHasher.matches(rawPassword, expected);
        if (maybeAccount.isEmpty() || !passwordMatches) {
            throw new InvalidCredentialsException("Invalid email or password");
        }
        // Only after the password matched: a stranger learns nothing about an account's standing.
        requireGoodStanding(maybeAccount.get());
        return issueTokens(maybeAccount.get());
    }

    @Override
    public AuthResult refresh(String rawRefreshToken) {
        if (rawRefreshToken == null || rawRefreshToken.isBlank()) {
            throw InvalidCredentialsException.sessionExpired("Missing refresh token");
        }
        RefreshToken current = refreshTokenRepository.findByTokenHash(tokenProvider.hashRefreshToken(rawRefreshToken))
                .orElseThrow(() -> InvalidCredentialsException.sessionExpired("Unknown refresh token"));
        Instant now = clock.instant();

        if (current.getRevokedAt() != null) {
            if (current.getRevokedAt().plus(refreshReuseGrace).isBefore(now)) {
                // A rotated/revoked token came back long after: assume it was stolen and end every session.
                log.warn("Refresh token reuse detected for user {}; revoking all sessions", current.getUserId());
                refreshTokenRepository.revokeAllForUser(current.getUserId());
            }
            throw InvalidCredentialsException.sessionExpired("Refresh token expired or revoked");
        }
        if (!current.isValid(now)) {
            throw InvalidCredentialsException.sessionExpired("Refresh token expired or revoked");
        }
        if (!refreshTokenRepository.revokeIfActive(current.getTokenHash(), now)) {
            // Lost a race with a concurrent refresh of the same token.
            throw InvalidCredentialsException.sessionExpired("Refresh token expired or revoked");
        }
        UserAccount account = userRepository.findById(current.getUserId())
                .filter(owner -> owner.isInGoodStanding(clock.instant()))
                .orElseThrow(() -> InvalidCredentialsException.sessionExpired("Refresh token owner no longer exists or may not sign in"));
        return issueTokens(account);
    }

    @Override
    public void logout(String rawRefreshToken) {
        if (rawRefreshToken == null || rawRefreshToken.isBlank()) {
            return;
        }
        refreshTokenRepository.findByTokenHash(tokenProvider.hashRefreshToken(rawRefreshToken))
                .ifPresent(token -> {
                    token.revoke();
                    refreshTokenRepository.save(token);
                });
    }

    @Override
    public AuthResult changePassword(UserId userId, String currentPassword, String newPassword) {
        UserAccount account = userRepository.findById(userId).orElseThrow(() -> new NotFoundException("Account", userId));
        if (currentPassword == null || !passwordHasher.matches(currentPassword, account.getPasswordHash())) {
            throw DomainValidationException.withCode(ErrorCodes.WRONG_PASSWORD, "The current password is wrong");
        }
        validatePassword(newPassword);
        account.changePassword(passwordHasher.hash(newPassword));
        UserAccount saved = userRepository.save(account);
        // Deleted, not revoked: a device still holding an old token must not look like a thief (see refresh).
        refreshTokenRepository.deleteAllForUser(userId);
        return issueTokens(saved);
    }

    private void requireGoodStanding(UserAccount account) {
        switch (account.standingAt(clock.instant())) {
            case SUSPENDED -> throw AccessDeniedDomainException.withCode(ErrorCodes.ACCOUNT_SUSPENDED,
                    "This account is suspended until " + account.getSuspendedUntil());
            case BANNED -> throw AccessDeniedDomainException.withCode(ErrorCodes.ACCOUNT_BANNED, "This account is banned");
            case ACTIVE -> {
            }
        }
    }

    private AuthResult issueTokens(UserAccount account) {
        TokenProviderPort.AccessToken accessToken = tokenProvider.issueAccessToken(account);
        String rawRefresh = tokenProvider.generateRefreshToken();
        Instant refreshExpiry = clock.instant().plus(tokenProvider.refreshTokenTtl());
        refreshTokenRepository.save(RefreshToken.issue(account.getId(), tokenProvider.hashRefreshToken(rawRefresh), refreshExpiry));
        return new AuthResult(account, accessToken.value(), accessToken.expiresAt(), rawRefresh, tokenProvider.refreshTokenTtl());
    }

    /// The one password rule, shared with `PasswordResetService`.
    static void validatePassword(String rawPassword) {
        if (rawPassword == null || rawPassword.length() < PASSWORD_MIN_LENGTH) {
            throw new DomainValidationException("Password must be at least " + PASSWORD_MIN_LENGTH + " characters");
        }
    }
}
