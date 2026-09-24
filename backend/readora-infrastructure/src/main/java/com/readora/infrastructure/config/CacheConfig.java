package com.readora.infrastructure.config;

import org.springframework.cache.annotation.EnableCaching;
import org.springframework.context.annotation.Configuration;

/// In-memory caches of hot read models (`spring.cache.*`: Caffeine, bounded, expiring). Each instance has its own:
/// fine for read models that may be a few minutes old, never for anything a write must see at once.
@Configuration
@EnableCaching
public class CacheConfig {
}
