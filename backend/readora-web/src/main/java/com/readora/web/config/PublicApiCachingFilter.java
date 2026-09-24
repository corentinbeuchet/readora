package com.readora.web.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.ShallowEtagHeaderFilter;

import java.io.IOException;

/// Anonymous reads of the API (catalog, series pages, chapters, rankings: what visitors and the prerender build ask
/// for) carry an `ETag` and `Cache-Control: no-cache`: the browser keeps them and asks again with `If-None-Match`, and
/// an unchanged answer comes back as an empty 304. Signed-in calls keep Spring Security's `no-store`: the same paths
/// answer with personal data then (followed teams, finished chapters), which must not stay in a browser cache.
/// `Vary: Authorization` keeps a cache from serving the anonymous answer to a signed-in call. Uploaded assets set their
/// own, longer caching (`StorageController`).
@Component
public class PublicApiCachingFilter extends ShallowEtagHeaderFilter {

    private static final String API = "/api/v1/";
    private static final String ASSETS = "/api/v1/storage/assets/";

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI().substring(request.getContextPath().length());
        return !HttpMethod.GET.matches(request.getMethod())
                || request.getHeader(HttpHeaders.AUTHORIZATION) != null
                || !path.startsWith(API)
                || path.startsWith(ASSETS);
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        response.setHeader(HttpHeaders.CACHE_CONTROL, "no-cache");
        response.addHeader(HttpHeaders.VARY, HttpHeaders.AUTHORIZATION);
        super.doFilterInternal(request, response, filterChain);
    }
}
