package com.readora.infrastructure.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

import java.time.Duration;

/// @param minInterval minimum time between two comments by the same reader (anti-spam, US-11); `0s` disables it
@ConfigurationProperties(prefix = "readora.comments")
public record CommentProperties(@DefaultValue("10s") Duration minInterval) {
}
