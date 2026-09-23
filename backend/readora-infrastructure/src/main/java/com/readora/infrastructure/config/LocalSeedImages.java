package com.readora.infrastructure.config;

import com.readora.application.port.out.StoragePort;
import org.jspecify.annotations.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

import javax.imageio.ImageIO;
import java.awt.Color;
import java.awt.GradientPaint;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.util.List;

/// LOCAL/DEV ONLY: draws the page images and covers the local seed (db/seed-local) points to, and stores them in
/// the media bucket, so seeded chapters can be read. Only keys under `seed/` are touched, and only when missing,
/// so restarts are cheap and a wiped bucket is refilled. Covers are set only on seeded series that have none.
@Component
@Profile(ProductionSecretsGuard.LOCAL_SEED_PROFILE)
public class LocalSeedImages implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(LocalSeedImages.class);
    private static final String SEED_WORK_IDS = "00000000-0000-4000-9000-%";
    // Seven-segment digits: segments a..g (top, top right, bottom right, bottom, bottom left, top left, middle).
    private static final int[] SEGMENTS = {0b0111111, 0b0000110, 0b1011011, 0b1001111, 0b1100110,
            0b1101101, 0b1111101, 0b0000111, 0b1111111, 0b1101111};

    private final JdbcClient jdbc;
    private final StoragePort storage;

    public LocalSeedImages(JdbcClient jdbc, StoragePort storage) {
        this.jdbc = jdbc;
        this.storage = storage;
    }

    @Override
    public void run(ApplicationArguments args) {
        int stored = storePages() + storeTaskPages() + storeCovers();
        if (stored > 0) {
            log.info("Local seed: stored {} placeholder images", stored);
        }
    }

    private int storePages() {
        List<SeedPage> pages = jdbc.sql("""
                        SELECT pa.storage_key, w.title, t.name, c.chapter_number, pa.page_number
                        FROM page_assets pa
                        JOIN chapters c ON c.id = pa.chapter_id
                        JOIN works w ON w.id = c.work_id
                        JOIN teams t ON t.id = c.team_id
                        WHERE pa.storage_key LIKE 'seed/%'""")
                .query((rs, row) -> new SeedPage(rs.getString(1), rs.getString(2), rs.getString(3), rs.getString(4), rs.getInt(5)))
                .list();
        return storeMissing(pages);
    }

    /// The demo task board's pages (the pages each stage works on, published by QC).
    private int storeTaskPages() {
        List<SeedPage> pages = jdbc.sql("""
                        SELECT tp.storage_key, w.title, t.name, wt.chapter_number, tp.page_number
                        FROM workflow_task_pages tp
                        JOIN workflow_tasks wt ON wt.id = tp.task_id
                        JOIN scanlation_projects sp ON sp.id = wt.project_id
                        JOIN works w ON w.id = sp.work_id
                        JOIN teams t ON t.id = sp.team_id
                        WHERE tp.storage_key LIKE 'seed/%'""")
                .query((rs, row) -> new SeedPage(rs.getString(1), rs.getString(2), rs.getString(3), rs.getString(4), rs.getInt(5)))
                .list();
        int stored = storeMissing(pages);
        // An upload returns its URL; the seed rows get theirs here, where the storage's public URL is known (the
        // board links each page, and the reader would fill it in from the key anyway).
        for (SeedPage page : pages) {
            jdbc.sql("UPDATE workflow_task_pages SET cdn_url = ? WHERE storage_key = ? AND cdn_url IS NULL")
                    .params(storage.getPublicCdnUrl(page.key()), page.key())
                    .update();
        }
        return stored;
    }

    private int storeMissing(List<SeedPage> pages) {
        int stored = 0;
        for (SeedPage page : pages) {
            if (storage.loadAsset(page.key()).isEmpty()) {
                storage.storeAsset(page.key(), png(page.title() + page.team(), List.of(page.chapter(), String.valueOf(page.number()))), "image/png");
                stored++;
            }
        }
        return stored;
    }

    private int storeCovers() {
        List<SeedWork> works = jdbc.sql("SELECT CAST(id AS VARCHAR(36)), title, cover_image_url FROM works WHERE CAST(id AS VARCHAR(36)) LIKE ?")
                .param(SEED_WORK_IDS)
                .query((rs, row) -> new SeedWork(rs.getString(1), rs.getString(2), rs.getString(3)))
                .list();
        int stored = 0;
        for (SeedWork work : works) {
            String key = "seed/covers/" + work.id() + ".png";
            String url = storage.getPublicCdnUrl(key);
            if (work.coverUrl() != null && !work.coverUrl().equals(url)) {
                continue;
            }
            if (storage.loadAsset(key).isEmpty()) {
                storage.storeAsset(key, png(work.title(), List.of()), "image/png");
                stored++;
            }
            if (work.coverUrl() == null) {
                jdbc.sql("UPDATE works SET cover_image_url = ? WHERE CAST(id AS VARCHAR(36)) = ?").params(url, work.id()).update();
            }
        }
        return stored;
    }

    /// A 800x1200 image on a colour picked from the series title, with the given numbers drawn as large
    /// seven-segment digits: shapes only, because the Alpine runtime image has no fonts for `drawString`.
    private static byte[] png(String title, List<String> numbers) {
        BufferedImage image = new BufferedImage(800, 1200, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = image.createGraphics();
        try {
            float hue = (title.hashCode() & 0xffff) / (float) 0xffff;
            g.setPaint(new GradientPaint(0, 0, Color.getHSBColor(hue, 0.55f, 0.85f), 0, 1200, Color.getHSBColor(hue, 0.7f, 0.35f)));
            g.fillRect(0, 0, 800, 1200);
            g.setColor(new Color(255, 255, 255, 60));
            g.fillRect(60, 60, 680, 1080);
            g.setColor(Color.WHITE);
            int y = 1200 / 2 - numbers.size() * 170;
            for (String number : numbers) {
                drawDigits(g, number, y);
                y += 340;
            }
        } finally {
            g.dispose();
        }
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        try {
            ImageIO.write(image, "png", out);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
        return out.toByteArray();
    }

    private static void drawDigits(Graphics2D g, String text, int top) {
        int w = 120, h = 240, t = 24, gap = 40;
        String digits = text.replaceAll("[^0-9]", "");
        int x = (800 - (digits.length() * (w + gap) - gap)) / 2;
        for (char c : digits.toCharArray()) {
            int mask = SEGMENTS[c - '0'];
            int mid = top + h / 2 - t / 2;
            if ((mask & 1) != 0) g.fillRect(x, top, w, t);
            if ((mask & 2) != 0) g.fillRect(x + w - t, top, t, h / 2);
            if ((mask & 4) != 0) g.fillRect(x + w - t, top + h / 2, t, h / 2);
            if ((mask & 8) != 0) g.fillRect(x, top + h - t, w, t);
            if ((mask & 16) != 0) g.fillRect(x, top + h / 2, t, h / 2);
            if ((mask & 32) != 0) g.fillRect(x, top, t, h / 2);
            if ((mask & 64) != 0) g.fillRect(x, mid, w, t);
            x += w + gap;
        }
    }

    private record SeedPage(String key, String title, String team, String chapter, int number) {
    }

    private record SeedWork(String id, String title, @Nullable String coverUrl) {
    }
}
