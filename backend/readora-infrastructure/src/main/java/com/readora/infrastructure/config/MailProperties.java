package com.readora.infrastructure.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/// @param from    sender of every email (`Readora <no-reply@readora.com>`)
/// @param siteUrl where readers open the site: links in emails point there (`https://readora.com`)
@ConfigurationProperties(prefix = "readora.mail")
public record MailProperties(String from, String siteUrl) {
}
