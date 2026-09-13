package com.readora.infrastructure.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.auth.credentials.AnonymousCredentialsProvider;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.AwsCredentialsProvider;
import software.amazon.awssdk.auth.credentials.DefaultCredentialsProvider;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3ClientBuilder;
import software.amazon.awssdk.services.s3.S3Configuration;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;

import java.net.URI;

@Configuration
public class S3ClientConfig {

    @Bean
    @ConditionalOnMissingBean
    public S3Client s3Client(
            @Value("${aws.s3.region:us-east-1}") String region,
            @Value("${aws.s3.endpoint:}") String endpoint,
            @Value("${aws.s3.access-key-id:}") String accessKeyId,
            @Value("${aws.s3.secret-access-key:}") String secretAccessKey,
            @Value("${aws.s3.path-style-access-enabled:false}") boolean pathStyleAccessEnabled
    ) {
        S3ClientBuilder builder = S3Client.builder()
                .region(Region.of(region));

        boolean hasCustomEndpoint = endpoint != null && !endpoint.isBlank();
        if (hasCustomEndpoint) {
            builder.endpointOverride(URI.create(endpoint));
        }

        boolean forcePathStyle = pathStyleAccessEnabled || hasCustomEndpoint;
        builder.serviceConfiguration(S3Configuration.builder()
                .pathStyleAccessEnabled(forcePathStyle)
                .build());

        AwsCredentialsProvider credentialsProvider = resolveCredentialsProvider(accessKeyId, secretAccessKey, hasCustomEndpoint);
        builder.credentialsProvider(credentialsProvider);

        return builder.build();
    }

    @Bean
    @ConditionalOnMissingBean
    public S3Presigner s3Presigner(
            @Value("${aws.s3.region:us-east-1}") String region,
            @Value("${aws.s3.endpoint:}") String endpoint,
            @Value("${aws.s3.access-key-id:}") String accessKeyId,
            @Value("${aws.s3.secret-access-key:}") String secretAccessKey,
            @Value("${aws.s3.path-style-access-enabled:false}") boolean pathStyleAccessEnabled
    ) {
        S3Presigner.Builder builder = S3Presigner.builder()
                .region(Region.of(region));

        boolean hasCustomEndpoint = endpoint != null && !endpoint.isBlank();
        if (hasCustomEndpoint) {
            builder.endpointOverride(URI.create(endpoint));
        }

        boolean forcePathStyle = pathStyleAccessEnabled || hasCustomEndpoint;
        builder.serviceConfiguration(S3Configuration.builder()
                .pathStyleAccessEnabled(forcePathStyle)
                .build());

        AwsCredentialsProvider credentialsProvider = resolveCredentialsProvider(accessKeyId, secretAccessKey, hasCustomEndpoint);
        builder.credentialsProvider(credentialsProvider);

        return builder.build();
    }

    private AwsCredentialsProvider resolveCredentialsProvider(String accessKeyId, String secretAccessKey, boolean hasCustomEndpoint) {
        if (accessKeyId != null && !accessKeyId.isBlank() && secretAccessKey != null && !secretAccessKey.isBlank()) {
            return StaticCredentialsProvider.create(AwsBasicCredentials.create(accessKeyId, secretAccessKey));
        }
        if (hasCustomEndpoint) {
            return AnonymousCredentialsProvider.create();
        }
        try {
            return DefaultCredentialsProvider.create();
        } catch (Exception e) {
            return AnonymousCredentialsProvider.create();
        }
    }
}
