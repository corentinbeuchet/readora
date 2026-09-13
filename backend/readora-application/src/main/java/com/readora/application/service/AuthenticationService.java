package com.readora.application.service;

import com.readora.application.port.in.AuthenticateUserUseCase;
import com.readora.application.port.out.EventPublisherPort;
import com.readora.application.port.out.PasswordHasherPort;
import com.readora.application.port.out.RefreshTokenRepositoryPort;
import com.readora.application.port.out.TokenProviderPort;
import com.readora.application.port.out.UserAccountRepositoryPort;
import com.readora.domain.common.DomainValidationException;
import com.readora.domain.identity.Email;
import com.readora.domain.identity.EmailAlreadyUsedException;
import com.readora.domain.identity.InvalidCredentialsException;
import com.readora.domain.identity.PasswordHash;
import com.readora.domain.identity.RefreshToken;
import com.readora.domain.identity.UserAccount;
import com.readora.domain.work.UserId;

import java.time.Instant;
import java.util.Objects;
import java.util.Optional;

public class AuthenticationService implements AuthenticateUserUseCase {
    public static final int PASSWORD_MIN_LENGTH = 8;

    private final UserAccountRepositoryPort userRepository;
    private final RefreshTokenRepositoryPort refreshTokenRepository;
    private final PasswordHasherPort passwordHasher;
    private final TokenProviderPort tokenProvider;
    private final EventPublisherPort eventPublisher;

    public AuthenticationService(UserAccountRepositoryPort userRepository,
                                 RefreshTokenRepositoryPort refreshTokenRepository,
                                 PasswordHasherPort passwordHasher,
                                 TokenProviderPort tokenProvider,
                                 EventPublisherPort eventPublisher) {
        this.userRepository = Objects.requireNonNull(userRepository, "UserAccountRepositoryPort cannot be null");
        this.refreshTokenRepository = Objects.requireNonNull(refreshTokenRepository, "RefreshTokenRepositoryPort cannot be null");
        this.passwordHasher = Objects.requireNonNull(passwordHasher, "PasswordHasherPort cannot be null");
        this.tokenProvider = Objects.requireNonNull(tokenProvider, "TokenProviderPort cannot be null");
        this.eventPublisher = Objects.requireNonNull(eventPublisher, "EventPublisherPort cannot be null");
    }

    @Override
    public AuthResult register(String rawEmail, String username, String rawPassword) {
        Email email = Email.of(rawEmail);
        validatePassword(rawPassword);
        if (userRepository.existsByEmail(email)) {
            throw new EmailAlreadyUsedException("Email already registered: " + email);
        }
        if (userRepository.existsByUsername(username)) {
            throw new EmailAlreadyUsedException("Username already taken: " + username);
        }

        UserAccount account = UserAccount.register(email, username, passwordHasher.hash(rawPassword));
        UserAccount saved = userRepository.save(account);
        account.pollDomainEvents().forEach(eventPublisher::publish);
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
        UserAccount account = userRepository.findByEmail(email)
                .orElseThrow(() -> new InvalidCredentialsException("Invalid email or password"));
        if (rawPassword == null || !passwordHasher.matches(rawPassword, account.getPasswordHash())) {
            throw new InvalidCredentialsException("Invalid email or password");
        }
        return issueTokens(account);
    }

    @Override
    public AuthResult refresh(String rawRefreshToken) {
        RefreshToken current = findValidToken(rawRefreshToken);
        UserAccount account = userRepository.findById(current.getUserId())
                .orElseThrow(() -> new InvalidCredentialsException("Refresh token owner no longer exists"));

        current.revoke();
        refreshTokenRepository.save(current);
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
    public Optional<UserAccount> currentAccount(UserId userId) {
        return userRepository.findById(userId);
    }

    private RefreshToken findValidToken(String rawRefreshToken) {
        if (rawRefreshToken == null || rawRefreshToken.isBlank()) {
            throw new InvalidCredentialsException("Missing refresh token");
        }
        RefreshToken token = refreshTokenRepository.findByTokenHash(tokenProvider.hashRefreshToken(rawRefreshToken))
                .orElseThrow(() -> new InvalidCredentialsException("Unknown refresh token"));
        if (!token.isValid(Instant.now())) {
            throw new InvalidCredentialsException("Refresh token expired or revoked");
        }
        return token;
    }

    private AuthResult issueTokens(UserAccount account) {
        TokenProviderPort.AccessToken accessToken = tokenProvider.issueAccessToken(account);
        String rawRefresh = tokenProvider.generateRefreshToken();
        Instant refreshExpiry = Instant.now().plus(tokenProvider.refreshTokenTtl());
        refreshTokenRepository.save(RefreshToken.issue(account.getId(), tokenProvider.hashRefreshToken(rawRefresh), refreshExpiry));
        return new AuthResult(account, accessToken.value(), accessToken.expiresAt(), rawRefresh, tokenProvider.refreshTokenTtl());
    }

    private static void validatePassword(String rawPassword) {
        if (rawPassword == null || rawPassword.length() < PASSWORD_MIN_LENGTH) {
            throw new DomainValidationException("Password must be at least " + PASSWORD_MIN_LENGTH + " characters");
        }
    }
}
