package com.readora.infrastructure.persistence;

import com.readora.infrastructure.config.CacheConfig;
import com.readora.infrastructure.persistence.adapter.DiscoveryQueryAdapter;
import jakarta.persistence.EntityManagerFactory;
import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.TestPropertySource;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;

/// The rankings are read once per window and served from the cache after (`CacheConfig`, `spring.cache.*`).
@SpringBootTest(classes = {TestApplication.class, CacheConfig.class})
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:h2:mem:readora_rankings_cache;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE;MODE=PostgreSQL",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.flyway.enabled=true",
        "spring.jpa.hibernate.ddl-auto=validate",
        "spring.jpa.database-platform=org.hibernate.dialect.H2Dialect",
        "spring.jpa.properties.hibernate.generate_statistics=true",
        "spring.cache.cache-names=popular-works",
        "spring.cache.caffeine.spec=maximumSize=32,expireAfterWrite=5m",
        "aws.s3.bucket-name=test-bucket",
        "aws.cloudfront.domain=https://cdn-test.readora.com",
        "readora.security.jwt.secret=test-secret-at-least-32-bytes-long-1234567890"
})
class RankingsCacheTest {

    @Autowired
    private DiscoveryQueryAdapter discovery;

    @Autowired
    private EntityManagerFactory entityManagerFactory;

    @Test
    @DisplayName("The same ranking window is read from the database once, then from the cache; another window reads again")
    void rankingsAreCachedPerWindow() {
        Statistics statistics = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
        Instant window = Instant.parse("2026-09-24T10:05:00Z");

        statistics.clear();
        discovery.findPopular(window, 20);
        long firstRead = statistics.getPrepareStatementCount();
        discovery.findPopular(window, 20);
        long secondRead = statistics.getPrepareStatementCount() - firstRead;
        discovery.findPopular(window.plusSeconds(300), 20);
        long nextWindow = statistics.getPrepareStatementCount() - firstRead - secondRead;

        assertThat(firstRead).isEqualTo(1);
        assertThat(secondRead).isZero();
        assertThat(nextWindow).isEqualTo(1);
    }
}
