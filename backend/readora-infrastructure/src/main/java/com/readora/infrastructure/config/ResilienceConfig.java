package com.readora.infrastructure.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.resilience.annotation.EnableResilientMethods;

/// Activates Spring Framework 7 `@Retryable` / `@ConcurrencyLimit` on infrastructure adapters.
/// Only idempotent external calls are retried; concurrency limits protect providers from virtual-thread bursts.
/// Class-based proxies are required: the annotations sit on adapter methods, not on the port interfaces.
@Configuration
@EnableResilientMethods(proxyTargetClass = true)
public class ResilienceConfig {
}
