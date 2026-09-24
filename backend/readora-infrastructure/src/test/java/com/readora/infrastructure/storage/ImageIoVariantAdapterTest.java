package com.readora.infrastructure.storage;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.Random;

import static org.assertj.core.api.Assertions.assertThat;

class ImageIoVariantAdapterTest {

    private final ImageIoVariantAdapter adapter = new ImageIoVariantAdapter();

    @Test
    @DisplayName("A large page becomes a 720 px wide JPEG that is smaller than the original")
    void largePageBecomesSmallJpeg() throws IOException {
        byte[] png = noisyPng(1600, 2400);

        byte[] lite = adapter.lightVersion(png).orElseThrow();

        assertThat(lite.length).isLessThan(png.length);
        BufferedImage decoded = ImageIO.read(new ByteArrayInputStream(lite));
        assertThat(decoded.getWidth()).isEqualTo(720);
        assertThat(decoded.getHeight()).isEqualTo(1080);
        assertThat(lite[0] & 0xFF).as("JPEG magic").isEqualTo(0xFF);
    }

    @Test
    @DisplayName("Garbage, empty input and copies that would be bigger give no data-saver copy")
    void noCopyForBadOrTinyInput() throws IOException {
        assertThat(adapter.lightVersion("dummy image content".getBytes())).isEmpty();
        assertThat(adapter.lightVersion(new byte[0])).isEmpty();
        // A flat 10 x 10 PNG is already tiny: the JPEG would be larger.
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ImageIO.write(new BufferedImage(10, 10, BufferedImage.TYPE_INT_RGB), "png", out);
        assertThat(adapter.lightVersion(out.toByteArray())).isEmpty();
    }

    @Test
    @DisplayName("A cover becomes a 480 px wide JPEG thumbnail")
    void coverBecomesThumbnail() throws IOException {
        byte[] thumbnail = adapter.coverThumbnail(noisyPng(800, 1200)).orElseThrow();

        BufferedImage decoded = ImageIO.read(new ByteArrayInputStream(thumbnail));
        assertThat(decoded.getWidth()).isEqualTo(480);
        assertThat(decoded.getHeight()).isEqualTo(720);
    }

    @Test
    @DisplayName("A cover thumbnail is made even when it is not smaller than the cover, never from garbage")
    void thumbnailAlwaysMadeForReadableImages() throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ImageIO.write(new BufferedImage(10, 10, BufferedImage.TYPE_INT_RGB), "png", out);

        assertThat(adapter.coverThumbnail(out.toByteArray())).isPresent();
        assertThat(adapter.coverThumbnail("dummy image content".getBytes())).isEmpty();
    }

    @Test
    @DisplayName("WebP uploads can be read (TwelveMonkeys plugin registered)")
    void webpReaderIsAvailable() {
        assertThat(ImageIO.getImageReadersByMIMEType("image/webp").hasNext()).isTrue();
    }

    private static byte[] noisyPng(int width, int height) throws IOException {
        BufferedImage image = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
        Random random = new Random(42);
        for (int y = 0; y < height; y++) {
            for (int x = 0; x < width; x++) {
                image.setRGB(x, y, random.nextInt(0xFFFFFF));
            }
        }
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ImageIO.write(image, "png", out);
        return out.toByteArray();
    }
}
