package com.readora.application.auth;

/// Names of the custom access-token claims: written by the token provider adapter, read by the web layer.
public final class TokenClaims {
    public static final String USERNAME = "username";
    public static final String PERMISSIONS = "permissions";

    private TokenClaims() {
    }
}
