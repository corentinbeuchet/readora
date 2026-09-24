package com.readora.web.security;

import com.readora.application.port.in.CheckAccountStandingUseCase;
import com.readora.domain.common.ErrorCodes;
import com.readora.domain.common.UserId;
import com.readora.domain.identity.AccountStanding;
import com.readora.web.dto.ApiResponse;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.filter.OncePerRequestFilter;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.util.Optional;
import java.util.Set;

/// Refuses writes from an account that may no longer write (US-16): suspended, banned, or deleted (US-15). An access
/// token outlives those decisions by up to its lifetime; reading stays allowed meanwhile. Added in the security chain
/// after the bearer token is read (not a servlet `@Component`, which would run before authentication).
public class AccountStandingFilter extends OncePerRequestFilter {

    private static final Set<String> READS = Set.of("GET", "HEAD", "OPTIONS");

    private final CheckAccountStandingUseCase standing;
    private final ObjectMapper objectMapper;

    public AccountStandingFilter(CheckAccountStandingUseCase standing, ObjectMapper objectMapper) {
        this.standing = standing;
        this.objectMapper = objectMapper;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        // Logging out (and the other /auth calls) must keep working for anyone.
        return READS.contains(request.getMethod()) || request.getRequestURI().startsWith("/api/v1/auth/");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (!(authentication instanceof JwtAuthenticationToken token) || token.getToken().getSubject() == null) {
            chain.doFilter(request, response);
            return;
        }
        Optional<AccountStanding> current = standing.standingOf(UserId.of(token.getToken().getSubject()));
        if (current.isPresent() && current.get() == AccountStanding.ACTIVE) {
            chain.doFilter(request, response);
            return;
        }
        String code = current.map(found -> found == AccountStanding.BANNED ? ErrorCodes.ACCOUNT_BANNED : ErrorCodes.ACCOUNT_SUSPENDED)
                .orElse(ErrorCodes.ACCOUNT_CLOSED);
        response.setStatus(HttpStatus.FORBIDDEN.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        objectMapper.writeValue(response.getOutputStream(), ApiResponse.error(code, "This account may not do that any more"));
    }
}
