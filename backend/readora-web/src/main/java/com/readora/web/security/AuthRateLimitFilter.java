package com.readora.web.security;

import com.readora.domain.common.ErrorCodes;
import com.readora.web.dto.ApiResponse;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.time.Clock;
import java.util.Set;

/// Limits credential attempts per client IP and endpoint; excess requests get HTTP 429 with `Retry-After`.
/// Behind a proxy the client IP comes from `X-Forwarded-For` via `server.forward-headers-strategy=native`.
@Component
@ConditionalOnProperty(name = "readora.security.rate-limit.enabled", havingValue = "true", matchIfMissing = true)
public class AuthRateLimitFilter extends OncePerRequestFilter {

    private static final Set<String> LIMITED_PATHS = Set.of("/api/v1/auth/login", "/api/v1/auth/register", "/api/v1/auth/refresh",
            "/api/v1/auth/password");

    private final FixedWindowRateLimiter limiter;
    private final ObjectMapper objectMapper;

    public AuthRateLimitFilter(RateLimitProperties properties, ObjectMapper objectMapper) {
        this.limiter = new FixedWindowRateLimiter(properties.maxAttempts(), properties.window(), Clock.systemUTC());
        this.objectMapper = objectMapper;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !"POST".equals(request.getMethod()) || !LIMITED_PATHS.contains(request.getRequestURI());
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String key = request.getRemoteAddr() + "|" + request.getRequestURI();
        if (limiter.tryAcquire(key)) {
            chain.doFilter(request, response);
            return;
        }
        response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
        response.setHeader(HttpHeaders.RETRY_AFTER, String.valueOf(limiter.secondsUntilReset(key)));
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        objectMapper.writeValue(response.getOutputStream(), ApiResponse.error(ErrorCodes.RATE_LIMITED, "Too many attempts, please try again later"));
    }
}
