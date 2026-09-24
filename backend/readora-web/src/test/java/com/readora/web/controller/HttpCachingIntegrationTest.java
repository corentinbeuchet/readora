package com.readora.web.controller;

import com.readora.web.ReadoraApplication;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MvcResult;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

@SpringBootTest(classes = ReadoraApplication.class)
@AutoConfigureMockMvc
@ActiveProfiles("test")
class HttpCachingIntegrationTest extends AuthTestSupport {

    private static final String CATALOG = "/api/v1/works?size=5";

    @Test
    @DisplayName("An anonymous read carries an ETag and no-cache, and asking again with that ETag answers 304 with no body")
    void anonymousReadsAreRevalidated() throws Exception {
        MvcResult first = whenAVisitorReads(CATALOG, null);

        thenTheAnswerIs(first, 200);
        thenItMayBeKeptButRevalidated(first);

        MvcResult again = whenAVisitorReads(CATALOG, first.getResponse().getHeader(HttpHeaders.ETAG));

        thenTheAnswerIs(again, 304);
        assertThat(again.getResponse().getContentAsByteArray()).isEmpty();
    }

    @Test
    @DisplayName("A signed-in read keeps no-store and carries no ETag: it may hold personal data")
    void signedInReadsAreNotStored() throws Exception {
        Session session = register();

        MvcResult result = mockMvc.perform(get(CATALOG).header(HttpHeaders.AUTHORIZATION, session.bearer())).andReturn();

        thenTheAnswerIs(result, 200);
        assertThat(result.getResponse().getHeader(HttpHeaders.CACHE_CONTROL)).contains("no-store");
        assertThat(result.getResponse().getHeader(HttpHeaders.ETAG)).isNull();
    }

    private MvcResult whenAVisitorReads(String path, String ifNoneMatch) throws Exception {
        var request = get(path);
        if (ifNoneMatch != null) {
            request.header(HttpHeaders.IF_NONE_MATCH, ifNoneMatch);
        }
        return mockMvc.perform(request).andReturn();
    }

    private static void thenTheAnswerIs(MvcResult result, int status) {
        assertThat(result.getResponse().getStatus()).isEqualTo(status);
    }

    private static void thenItMayBeKeptButRevalidated(MvcResult result) {
        assertThat(result.getResponse().getHeader(HttpHeaders.ETAG)).isNotBlank();
        assertThat(result.getResponse().getHeader(HttpHeaders.CACHE_CONTROL)).isEqualTo("no-cache");
        assertThat(result.getResponse().getHeaders(HttpHeaders.VARY)).contains(HttpHeaders.AUTHORIZATION);
    }
}
