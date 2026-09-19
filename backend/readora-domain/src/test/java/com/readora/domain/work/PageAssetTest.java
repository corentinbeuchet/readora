package com.readora.domain.work;

import com.readora.domain.common.DomainValidationException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class PageAssetTest {

    @Test
    @DisplayName("A page description is trimmed, blank means none, and it is limited to 500 characters")
    void descriptionIsNormalisedAndBounded() {
        assertThat(new PageAsset(1, "p1.webp", null, 0, 0, "  Bam looks up  ").description()).isEqualTo("Bam looks up");
        assertThat(new PageAsset(1, "p1.webp", null, 0, 0, "   ").description()).isNull();
        assertThat(new PageAsset(1, "p1.webp", null, 0, 0, "x".repeat(500)).description()).hasSize(500);
        assertThatThrownBy(() -> new PageAsset(1, "p1.webp", null, 0, 0, "x".repeat(501)))
                .isInstanceOf(DomainValidationException.class);
    }

    @Test
    @DisplayName("Swapping the URL keeps the page's description")
    void withCdnUrlKeepsTheDescription() {
        PageAsset page = new PageAsset(2, "p2.webp", null, 800, 1200, "A storm");
        assertThat(page.withCdnUrl("https://cdn/p2.webp")).isEqualTo(new PageAsset(2, "p2.webp", "https://cdn/p2.webp", 800, 1200, "A storm"));
    }
}
