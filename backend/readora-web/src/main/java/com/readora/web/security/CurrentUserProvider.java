package com.readora.web.security;

import com.readora.domain.identity.Permission;
import com.readora.domain.work.UserId;
import com.readora.application.auth.TokenClaims;
import org.springframework.security.authentication.AuthenticationCredentialsNotFoundException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;

import java.util.EnumSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

@Component
public class CurrentUserProvider {

    public Optional<AuthenticatedUser> current() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated() || !(authentication.getPrincipal() instanceof Jwt jwt)) {
            return Optional.empty();
        }
        return Optional.of(fromJwt(jwt));
    }

    public AuthenticatedUser require() {
        return current().orElseThrow(() -> new AuthenticationCredentialsNotFoundException("Authentication required"));
    }

    public UserId requireUserId() {
        return require().userId();
    }

    static AuthenticatedUser fromJwt(Jwt jwt) {
        String username = jwt.getClaimAsString(TokenClaims.USERNAME);
        List<String> rawPermissions = jwt.getClaimAsStringList(TokenClaims.PERMISSIONS);
        Set<Permission> permissions = EnumSet.noneOf(Permission.class);
        if (rawPermissions != null) {
            for (String raw : rawPermissions) {
                try {
                    permissions.add(Permission.valueOf(raw));
                } catch (IllegalArgumentException ignored) {
                    // Unknown permission in an old token: ignore rather than fail the request.
                }
            }
        }
        return new AuthenticatedUser(UserId.of(jwt.getSubject()), username, permissions);
    }
}
