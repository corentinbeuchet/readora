package com.readora.web.controller;

import com.readora.application.port.in.AuthenticateUserUseCase.AuthResult;
import com.readora.application.port.in.AuthenticateUserUseCase;
import com.readora.application.port.in.DeleteAccountUseCase;
import com.readora.application.port.in.ResetPasswordUseCase.SiteLanguage;
import com.readora.application.port.in.ResetPasswordUseCase;
import com.readora.domain.identity.InvalidCredentialsException;
import com.readora.web.dto.ApiResponse;
import com.readora.web.dto.AuthResponse;
import com.readora.web.dto.ChangePasswordRequest;
import com.readora.web.dto.DeleteAccountRequest;
import com.readora.web.dto.LoginRequest;
import com.readora.web.dto.PasswordResetRequest;
import com.readora.web.dto.RegisterRequest;
import com.readora.web.dto.ResetPasswordRequest;
import com.readora.web.security.CurrentUserProvider;
import com.readora.web.security.RefreshCookieProperties;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;

@RestController
@RequestMapping("/api/v1/auth")
@Tag(name = "Authentication", description = "Registration, login, token refresh and logout")
public class AuthController {

    static final String REFRESH_COOKIE_PATH = "/api/v1/auth";

    private final AuthenticateUserUseCase authenticateUserUseCase;
    private final RefreshCookieProperties securityProperties;
    private final CurrentUserProvider currentUserProvider;
    private final ResetPasswordUseCase resetPasswordUseCase;
    private final DeleteAccountUseCase deleteAccountUseCase;

    public AuthController(AuthenticateUserUseCase authenticateUserUseCase,
                          RefreshCookieProperties securityProperties,
                          CurrentUserProvider currentUserProvider,
                          ResetPasswordUseCase resetPasswordUseCase,
                          DeleteAccountUseCase deleteAccountUseCase) {
        this.authenticateUserUseCase = authenticateUserUseCase;
        this.resetPasswordUseCase = resetPasswordUseCase;
        this.deleteAccountUseCase = deleteAccountUseCase;
        this.securityProperties = securityProperties;
        this.currentUserProvider = currentUserProvider;
    }

    @PostMapping("/register")
    @Operation(summary = "Register a new reader account")
    public ResponseEntity<ApiResponse<AuthResponse>> register(@Valid @RequestBody RegisterRequest request) {
        AuthResult result = authenticateUserUseCase.register(request.email(), request.username(), request.password());
        return withRefreshCookie(ResponseEntity.status(HttpStatus.CREATED), result)
                .body(ApiResponse.ok(AuthResponse.from(result)));
    }

    @PostMapping("/login")
    @Operation(summary = "Log in with email and password")
    public ResponseEntity<ApiResponse<AuthResponse>> login(@Valid @RequestBody LoginRequest request) {
        AuthResult result = authenticateUserUseCase.login(request.email(), request.password());
        return withRefreshCookie(ResponseEntity.ok(), result)
                .body(ApiResponse.ok(AuthResponse.from(result)));
    }

    @PostMapping("/refresh")
    @Operation(summary = "Rotate the refresh token and issue a new access token")
    public ResponseEntity<ApiResponse<AuthResponse>> refresh(
            @CookieValue(name = "${readora.security.refresh-cookie-name:readora_refresh}", required = false) String refreshToken) {
        if (refreshToken == null || refreshToken.isBlank()) {
            throw InvalidCredentialsException.sessionExpired("Missing refresh token");
        }
        AuthResult result = authenticateUserUseCase.refresh(refreshToken);
        return withRefreshCookie(ResponseEntity.ok(), result)
                .body(ApiResponse.ok(AuthResponse.from(result)));
    }

    @PostMapping("/logout")
    @Operation(summary = "Revoke the refresh token and clear the cookie")
    public ResponseEntity<ApiResponse<String>> logout(
            @CookieValue(name = "${readora.security.refresh-cookie-name:readora_refresh}", required = false) String refreshToken) {
        authenticateUserUseCase.logout(refreshToken);
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, clearedRefreshCookie().toString())
                .body(ApiResponse.ok("Logged out"));
    }

    @PostMapping("/password")
    @PreAuthorize("hasAuthority('LIBRARY_USE')")
    @Operation(summary = "Change my password; other sessions end and this one gets new tokens")
    public ResponseEntity<ApiResponse<AuthResponse>> changePassword(@Valid @RequestBody ChangePasswordRequest request) {
        AuthResult result = authenticateUserUseCase.changePassword(currentUserProvider.requireUserId(), request.currentPassword(),
                request.newPassword());
        return withRefreshCookie(ResponseEntity.ok(), result)
                .body(ApiResponse.ok(AuthResponse.from(result)));
    }

    @PostMapping("/delete-account")
    @PreAuthorize("hasAuthority('LIBRARY_USE')")
    @Operation(summary = "Delete my account: what only I had is erased, comments and reviews stay under a placeholder name")
    public ResponseEntity<ApiResponse<String>> deleteAccount(@Valid @RequestBody DeleteAccountRequest request) {
        deleteAccountUseCase.deleteAccount(currentUserProvider.requireUserId(), request.password());
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, clearedRefreshCookie().toString())
                .body(ApiResponse.ok("Account deleted"));
    }

    @PostMapping("/password-reset")
    @Operation(summary = "Email a password reset link, if an account uses this address (the answer is the same either way)")
    public ResponseEntity<ApiResponse<String>> requestPasswordReset(@Valid @RequestBody PasswordResetRequest request) {
        resetPasswordUseCase.requestReset(request.email(), "fr".equals(request.language()) ? SiteLanguage.FRENCH : SiteLanguage.ENGLISH);
        return ResponseEntity.ok(ApiResponse.ok("If an account uses this email, a reset link is on its way"));
    }

    @PostMapping("/password-reset/confirm")
    @Operation(summary = "Choose a new password with the token of a reset link; every session of the account ends")
    public ResponseEntity<ApiResponse<String>> resetPassword(@Valid @RequestBody ResetPasswordRequest request) {
        resetPasswordUseCase.resetPassword(request.token(), request.newPassword());
        return ResponseEntity.ok(ApiResponse.ok("Password changed"));
    }

    private ResponseEntity.BodyBuilder withRefreshCookie(ResponseEntity.BodyBuilder builder, AuthResult result) {
        return builder.header(HttpHeaders.SET_COOKIE, refreshCookie(result.refreshToken(), result.refreshTokenTtl()).toString());
    }

    private ResponseCookie refreshCookie(String value, Duration maxAge) {
        return ResponseCookie.from(securityProperties.refreshCookieName(), value)
                .httpOnly(true)
                .secure(securityProperties.cookieSecure())
                .sameSite("Lax")
                .path(REFRESH_COOKIE_PATH)
                .maxAge(maxAge)
                .build();
    }

    private ResponseCookie clearedRefreshCookie() {
        return ResponseCookie.from(securityProperties.refreshCookieName(), "")
                .httpOnly(true)
                .secure(securityProperties.cookieSecure())
                .sameSite("Lax")
                .path(REFRESH_COOKIE_PATH)
                .maxAge(0)
                .build();
    }
}
