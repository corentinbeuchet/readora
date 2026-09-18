package com.readora.infrastructure.config;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;

import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ProductionSecretsGuardTest {

    private static final String DEV_SECRET = "dev-only-readora-jwt-secret-please-change-me-0123456789";
    private static final String REAL_SECRET = "Zq8v1rT0mLkP3sXw9YbN6cHdJ2fGaE5u7KiOpQrStUvW";

    @Test
    @DisplayName("Production profile refuses to start with the development JWT secret")
    void productionRejectsPlaceholderSecret() {
        assertThatThrownBy(() -> new ProductionSecretsGuard(env("production"), props(DEV_SECRET)))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("READORA_JWT_SECRET");
    }

    @Test
    @DisplayName("Production profile starts with a real JWT secret")
    void productionAcceptsRealSecret() {
        assertThatCode(() -> new ProductionSecretsGuard(env("production"), props(REAL_SECRET))).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("Non-production profiles may use the development JWT secret")
    void otherProfilesAllowPlaceholderSecret() {
        assertThatCode(() -> new ProductionSecretsGuard(env("staging"), props(DEV_SECRET))).doesNotThrowAnyException();
        assertThatCode(() -> new ProductionSecretsGuard(env(), props(DEV_SECRET))).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("A blank JWT secret is rejected whatever the profile")
    void blankSecretIsRejected() {
        assertThatThrownBy(() -> props(" ")).isInstanceOf(IllegalStateException.class);
    }

    @Test
    @DisplayName("The JWT secret never appears in toString")
    void secretIsMaskedInToString() {
        assertThat(props(REAL_SECRET).toString()).doesNotContain(REAL_SECRET);
    }

    private static MockEnvironment env(String... profiles) {
        MockEnvironment environment = new MockEnvironment();
        environment.setActiveProfiles(profiles);
        return environment;
    }

    private static SecurityProperties props(String secret) {
        return new SecurityProperties(
                new SecurityProperties.Jwt(secret, "readora", Duration.ofMinutes(15), Duration.ofDays(30)),
                "readora_refresh",
                true);
    }
}
