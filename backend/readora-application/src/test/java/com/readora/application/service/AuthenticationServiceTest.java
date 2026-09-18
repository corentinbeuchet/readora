package com.readora.application.service;

import com.readora.application.port.out.EventPublisherPort;
import com.readora.application.port.out.PasswordHasherPort;
import com.readora.application.port.out.RefreshTokenRepositoryPort;
import com.readora.application.port.out.TokenProviderPort;
import com.readora.application.port.out.UserAccountRepositoryPort;
import com.readora.domain.identity.Email;
import com.readora.domain.identity.InvalidCredentialsException;
import com.readora.domain.identity.PasswordHash;
import com.readora.domain.identity.RefreshToken;
import com.readora.domain.common.UserId;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.time.Instant;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class AuthenticationServiceTest {

    private static final PasswordHash DUMMY = PasswordHash.of("$2a$10$dummy");

    private UserAccountRepositoryPort users;
    private RefreshTokenRepositoryPort refreshTokens;
    private PasswordHasherPort hasher;
    private TokenProviderPort tokens;
    private AuthenticationService service;

    @BeforeEach
    void setUp() {
        users = mock(UserAccountRepositoryPort.class);
        refreshTokens = mock(RefreshTokenRepositoryPort.class);
        hasher = mock(PasswordHasherPort.class);
        tokens = mock(TokenProviderPort.class);
        when(hasher.hash(anyString())).thenReturn(DUMMY);
        when(tokens.hashRefreshToken(anyString())).thenAnswer(i -> "h:" + i.getArgument(0));
        service = new AuthenticationService(users, refreshTokens, hasher, tokens, mock(EventPublisherPort.class), Duration.ofSeconds(30));
    }

    @Test
    @DisplayName("Login with an unknown email still performs a password hash comparison (no timing oracle)")
    void unknownEmailStillComparesAHash() {
        when(users.findByEmail(any(Email.class))).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.login("ghost@readora.test", "whatever-password"))
                .isInstanceOf(InvalidCredentialsException.class);
        verify(hasher).matches("whatever-password", DUMMY);
    }

    @Test
    @DisplayName("A token revoked long ago that comes back revokes all sessions of its owner")
    void lateReuseRevokesAllSessions() {
        UserId owner = UserId.of("u1");
        RefreshToken revoked = new RefreshToken(java.util.UUID.randomUUID(), owner, "h:old", Instant.now().plus(Duration.ofDays(1)),
                Instant.now().minus(Duration.ofMinutes(5)), Instant.now().minus(Duration.ofDays(1)));
        when(refreshTokens.findByTokenHash("h:old")).thenReturn(Optional.of(revoked));

        assertThatThrownBy(() -> service.refresh("old")).isInstanceOf(InvalidCredentialsException.class);
        verify(refreshTokens).revokeAllForUser(owner);
    }

    @Test
    @DisplayName("A token revoked seconds ago (concurrent tabs) is rejected without revoking other sessions")
    void reuseWithinGraceOnlyRejects() {
        RefreshToken justRotated = new RefreshToken(java.util.UUID.randomUUID(), UserId.of("u1"), "h:old",
                Instant.now().plus(Duration.ofDays(1)), Instant.now().minusSeconds(2), Instant.now().minus(Duration.ofDays(1)));
        when(refreshTokens.findByTokenHash("h:old")).thenReturn(Optional.of(justRotated));

        assertThatThrownBy(() -> service.refresh("old")).isInstanceOf(InvalidCredentialsException.class);
        verify(refreshTokens, never()).revokeAllForUser(any());
    }

    @Test
    @DisplayName("Losing the atomic rotation race to a concurrent refresh is rejected and issues nothing")
    void concurrentRefreshLoserIsRejected() {
        RefreshToken active = RefreshToken.issue(UserId.of("u1"), "h:tok", Instant.now().plus(Duration.ofDays(1)));
        when(refreshTokens.findByTokenHash("h:tok")).thenReturn(Optional.of(active));
        when(refreshTokens.revokeIfActive(eq("h:tok"), any())).thenReturn(false);

        assertThatThrownBy(() -> service.refresh("tok")).isInstanceOf(InvalidCredentialsException.class);
        verify(tokens, never()).issueAccessToken(any());
        verify(refreshTokens, never()).save(any());
    }
}
