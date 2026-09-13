package com.readora.web.dto;

import com.readora.application.port.in.AuthenticateUserUseCase;

public record AuthResponse(
        String accessToken,
        String tokenType,
        long expiresIn,
        UserProfileDto user
) {
    public static AuthResponse from(AuthenticateUserUseCase.AuthResult result) {
        return new AuthResponse(
                result.accessToken(),
                "Bearer",
                result.expiresInSeconds(),
                UserProfileDto.fromDomain(result.account())
        );
    }
}
