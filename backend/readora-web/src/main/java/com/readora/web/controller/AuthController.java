package com.readora.web.controller;

import com.readora.application.port.in.AuthenticateUserUseCase;
import com.readora.application.port.in.AuthenticateUserUseCase.AuthResult;
import com.readora.domain.identity.InvalidCredentialsException;
import com.readora.domain.identity.UserAccount;
import com.readora.infrastructure.config.SecurityProperties;
import com.readora.web.dto.ApiResponse;
import com.readora.web.dto.AuthResponse;
import com.readora.web.dto.LoginRequest;
import com.readora.web.dto.RegisterRequest;
import com.readora.web.dto.UserProfileDto;
import com.readora.web.security.CurrentUserProvider;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.GetMapping;
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
    private final CurrentUserProvider currentUserProvider;
    private final SecurityProperties securityProperties;

    public AuthController(AuthenticateUserUseCase authenticateUserUseCase,
                          CurrentUserProvider currentUserProvider,
                          SecurityProperties securityProperties) {
        this.authenticateUserUseCase = authenticateUserUseCase;
        this.currentUserProvider = currentUserProvider;
        this.securityProperties = securityProperties;
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
            throw new InvalidCredentialsException("Missing refresh token");
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

    @GetMapping("/me")
    @Operation(summary = "Get the authenticated user's profile and effective permissions")
    public ResponseEntity<ApiResponse<UserProfileDto>> me() {
        UserAccount account = authenticateUserUseCase.currentAccount(currentUserProvider.requireUserId())
                .orElseThrow(() -> new InvalidCredentialsException("Account no longer exists"));
        return ResponseEntity.ok(ApiResponse.ok(UserProfileDto.fromDomain(account)));
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
