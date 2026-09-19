package com.readora.application.service;

import com.readora.application.port.out.ImageVariantPort;
import com.readora.application.port.out.StoragePort;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.endsWith;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AssetServiceTest {

    @Mock
    private StoragePort storage;

    @Mock
    private ImageVariantPort variants;

    @Test
    @DisplayName("An uploaded image also gets a data-saver copy stored next to it as <key>.lite.jpg")
    void imageGetsALiteCopy() {
        byte[] original = new byte[1000];
        byte[] lite = new byte[100];
        when(variants.lightVersion(original)).thenReturn(Optional.of(lite));
        when(storage.getPublicCdnUrl(anyString())).thenAnswer(i -> "https://cdn/" + i.getArgument(0));

        var stored = new AssetService(storage, variants).upload("scans/w/c1", "p1.webp", "image/webp", original);

        verify(storage).storeAsset(stored.storageKey(), original, "image/webp");
        verify(storage).storeAsset(stored.storageKey() + ".lite.jpg", lite, "image/jpeg");
        assertThat(stored.litePublicUrl()).isEqualTo("https://cdn/" + stored.storageKey() + ".lite.jpg");
    }

    @Test
    @DisplayName("No copy when it would not be smaller, and none is attempted for archives")
    void noCopyWhenNotUseful() {
        when(storage.getPublicCdnUrl(anyString())).thenReturn("https://cdn/x");
        when(variants.lightVersion(any())).thenReturn(Optional.empty());
        AssetService service = new AssetService(storage, variants);

        assertThat(service.upload("scans", "p1.png", "image/png", new byte[10]).litePublicUrl()).isNull();
        verify(storage, never()).storeAsset(endsWith(".lite.jpg"), any(), eq("image/jpeg"));

        AssetService archives = new AssetService(storage, variants);
        org.mockito.Mockito.reset(variants);
        assertThat(archives.upload("raw", "c1.zip", "application/zip", new byte[10]).litePublicUrl()).isNull();
        verifyNoInteractions(variants);
    }
}
