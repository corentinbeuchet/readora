package com.readora.infrastructure.storage;

import com.readora.application.port.out.ImageVariantPort;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.resilience.annotation.ConcurrencyLimit;
import org.springframework.stereotype.Component;

import javax.imageio.IIOImage;
import javax.imageio.ImageIO;
import javax.imageio.ImageReadParam;
import javax.imageio.ImageReader;
import javax.imageio.ImageWriteParam;
import javax.imageio.ImageWriter;
import javax.imageio.stream.ImageInputStream;
import javax.imageio.stream.ImageOutputStream;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.Iterator;
import java.util.Optional;

/// Data-saver copies with the JDK's ImageIO (JPEG, PNG, GIF) plus the TwelveMonkeys WebP reader: at most
/// [#MAX_WIDTH] px wide, JPEG quality [#QUALITY].
///
/// Decoding is bounded: images above [#MAX_SOURCE_PIXELS] are skipped, wide images are decoded subsampled so no
/// more than [#MAX_DECODED_PIXELS] are held in memory, and at most 4 uploads are converted at once.
@Component
public class ImageIoVariantAdapter implements ImageVariantPort {

    static final int MAX_WIDTH = 720;
    static final float QUALITY = 0.6f;
    /// Long webtoon strips are allowed (e.g. 800 × 40 000); anything bigger is not worth decoding.
    static final long MAX_SOURCE_PIXELS = 50_000_000L;
    static final long MAX_DECODED_PIXELS = 25_000_000L;

    private static final Logger log = LoggerFactory.getLogger(ImageIoVariantAdapter.class);

    public ImageIoVariantAdapter() {
        // In a Spring Boot fat jar the plugins are not on the class path ImageIO scanned at start-up.
        ImageIO.scanForPlugins();
    }

    @Override
    @ConcurrencyLimit(4)
    public Optional<byte[]> lightVersion(byte[] image) {
        try (ImageInputStream in = ImageIO.createImageInputStream(new ByteArrayInputStream(image))) {
            Iterator<ImageReader> readers = in == null ? null : ImageIO.getImageReaders(in);
            if (readers == null || !readers.hasNext()) {
                return Optional.empty();
            }
            ImageReader reader = readers.next();
            try {
                reader.setInput(in, true, true);
                BufferedImage decoded = decode(reader);
                if (decoded == null) {
                    return Optional.empty();
                }
                byte[] jpeg = toJpeg(scaled(decoded));
                return jpeg.length < image.length ? Optional.of(jpeg) : Optional.empty();
            } finally {
                reader.dispose();
            }
        } catch (IOException | RuntimeException e) {
            log.warn("No data-saver copy for an uploaded image: {}", e.toString());
            return Optional.empty();
        }
    }

    private static @org.jspecify.annotations.Nullable BufferedImage decode(ImageReader reader) throws IOException {
        int width = reader.getWidth(0);
        int height = reader.getHeight(0);
        long pixels = (long) width * height;
        if (width <= 0 || height <= 0 || pixels > MAX_SOURCE_PIXELS) {
            return null;
        }
        int step = Math.max(1, width / MAX_WIDTH);
        while (pixels / ((long) step * step) > MAX_DECODED_PIXELS) {
            step++;
        }
        ImageReadParam param = reader.getDefaultReadParam();
        param.setSourceSubsampling(step, step, 0, 0);
        return reader.read(0, param);
    }

    /// JPEG has no alpha: transparent areas become white, like the reader's default page background.
    private static BufferedImage scaled(BufferedImage source) {
        int width = Math.min(MAX_WIDTH, source.getWidth());
        int height = Math.max(1, (int) Math.round((double) source.getHeight() * width / source.getWidth()));
        BufferedImage target = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = target.createGraphics();
        try {
            g.setColor(Color.WHITE);
            g.fillRect(0, 0, width, height);
            g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
            g.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
            g.drawImage(source, 0, 0, width, height, null);
        } finally {
            g.dispose();
        }
        return target;
    }

    private static byte[] toJpeg(BufferedImage image) throws IOException {
        ImageWriter writer = ImageIO.getImageWritersByFormatName("jpeg").next();
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        try (ImageOutputStream ios = ImageIO.createImageOutputStream(out)) {
            writer.setOutput(ios);
            ImageWriteParam param = writer.getDefaultWriteParam();
            param.setCompressionMode(ImageWriteParam.MODE_EXPLICIT);
            param.setCompressionQuality(QUALITY);
            writer.write(null, new IIOImage(image, null, null), param);
        } finally {
            writer.dispose();
        }
        return out.toByteArray();
    }
}
