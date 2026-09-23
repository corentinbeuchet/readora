package com.readora.infrastructure.storage;

import com.readora.application.port.out.StoragePort;
import com.readora.infrastructure.config.ResilienceConfig;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectResponse;
import software.amazon.awssdk.services.s3.model.S3Exception;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class S3StorageAdapterResilienceTest {

    @Test
    @DisplayName("A transient S3 failure is retried through the Spring proxy and the upload succeeds")
    void transientFailureIsRetried() {
        S3Client s3Client = mock(S3Client.class);
        when(s3Client.putObject(any(PutObjectRequest.class), any(RequestBody.class)))
                .thenThrow(S3Exception.builder().message("503 Slow Down").build())
                .thenReturn(PutObjectResponse.builder().build());

        try (var context = new AnnotationConfigApplicationContext()) {
            context.register(ResilienceConfig.class);
            context.registerBean(StoragePort.class, () ->
                    new S3StorageAdapter(s3Client, "readora-media-dev", "", System.getProperty("java.io.tmpdir")));
            context.refresh();

            context.getBean(StoragePort.class).storeAsset("covers/retry.png", "x".getBytes(), "image/png");
        }

        verify(s3Client, times(2)).putObject(any(PutObjectRequest.class), any(RequestBody.class));
    }
}
