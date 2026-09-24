package com.readora.application.service;

import com.readora.application.port.in.ManageAssetsUseCase;
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

    @Test
    @DisplayName("An uploaded cover also gets its thumbnail stored next to it as <key>.thumb.jpg")
    void coverGetsAThumbnail() {
        byte[] cover = new byte[1000];
        byte[] thumbnail = new byte[100];
        when(variants.lightVersion(cover)).thenReturn(Optional.empty());
        when(variants.coverThumbnail(cover)).thenReturn(Optional.of(thumbnail));
        when(storage.getPublicCdnUrl(anyString())).thenAnswer(i -> "https://cdn/" + i.getArgument(0));

        var stored = new AssetService(storage, variants).upload("covers", "cover.png", "image/png", cover);

        verify(storage).storeAsset(stored.storageKey() + ".thumb.jpg", thumbnail, "image/jpeg");
        assertThat(ManageAssetsUseCase.coverThumbnailOf(stored.publicUrl())).isEqualTo(stored.publicUrl() + ".thumb.jpg");
    }

    @Test
    @DisplayName("A page upload gets no cover thumbnail")
    void pageGetsNoThumbnail() {
        when(variants.lightVersion(any())).thenReturn(Optional.empty());
        when(storage.getPublicCdnUrl(anyString())).thenAnswer(i -> "https://cdn/" + i.getArgument(0));

        new AssetService(storage, variants).upload("scans/w/c1", "p1.png", "image/png", new byte[10]);

        verify(variants, never()).coverThumbnail(any());
    }

    @Test
    @DisplayName("Only covers the server stored have a thumbnail: uploads and seed covers, not a cover hosted elsewhere")
    void thumbnailOnlyForStoredCovers() {
        String uuid = "0b8f3c1e-2a4d-4e6f-8a0b-1c2d3e4f5a6b";

        assertThat(ManageAssetsUseCase.coverThumbnailOf("https://cdn.readora.com/covers/" + uuid + "-cover.png"))
                .isEqualTo("https://cdn.readora.com/covers/" + uuid + "-cover.png.thumb.jpg");
        assertThat(ManageAssetsUseCase.coverThumbnailOf("/api/v1/storage/assets/covers/" + uuid + "-a.webp")).endsWith(".thumb.jpg");
        assertThat(ManageAssetsUseCase.coverThumbnailOf("http://localhost:9000/media/seed/covers/" + uuid + ".png")).endsWith(".thumb.jpg");
        assertThat(ManageAssetsUseCase.coverThumbnailOf("https://example.com/covers/solo-leveling.jpg")).isNull();
        assertThat(ManageAssetsUseCase.coverThumbnailOf("https://cdn.readora.com/scans/" + uuid + "-p1.png")).isNull();
        assertThat(ManageAssetsUseCase.coverThumbnailOf(null)).isNull();
    }
}
