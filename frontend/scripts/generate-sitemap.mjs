#!/usr/bin/env node
/**
 * Generates `sitemap.xml` in the browser output folder from the public catalog API.
 *
 * Runs after `npm run build` (npm `postbuild` hook) and explicitly at the end of `build:prod` /
 * `build:staging` (npm only fires `post<name>` hooks for the exact script name). Configure with env vars:
 *   READORA_API_URL   backend base URL (default: value inferred from the build configuration)
 *   READORA_SITE_URL  public frontend origin used for <loc> (default: inferred likewise)
 *   READORA_OUT_DIR   output directory (default: dist/readora-frontend/browser)
 *
 * When the API is unreachable the sitemap still contains the static routes, so the build never fails.
 */
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const CONFIG = (process.env.npm_config_configuration ?? process.argv.find((a) => a.startsWith('--configuration='))?.split('=')[1] ?? 'production').toLowerCase();

const DEFAULTS = {
  production: { api: 'https://api.readora.com/api/v1', site: 'https://readora.com' },
  staging: { api: 'https://staging-api.readora.com/api/v1', site: 'https://staging.readora.com' },
  development: { api: 'http://localhost:8080/api/v1', site: 'http://localhost:4200' }
};
const defaults = DEFAULTS[CONFIG] ?? DEFAULTS.production;

const API_URL = (process.env.READORA_API_URL ?? defaults.api).replace(/\/+$/, '');
const SITE_URL = (process.env.READORA_SITE_URL ?? defaults.site).replace(/\/+$/, '');
const OUT_DIR = resolve(process.env.READORA_OUT_DIR ?? 'dist/readora-frontend/browser');
/** Site languages, as in src/app/core/i18n/site-locales.ts and angular.json `i18n` (keep the three in sync). */
const LOCALES = [
  { code: 'en', prefix: '' },
  { code: 'fr', prefix: '/fr' }
];
const MAX_WORKS = 1000;
const TIMEOUT_MS = 10_000;

async function fetchApi(path) {
  try {
    const res = await fetch(`${API_URL}${path}`, { signal: AbortSignal.timeout(TIMEOUT_MS), headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    const body = await res.json();
    return body?.success ? body.data : null;
  } catch {
    return null;
  }
}

/** One <url> per site language for `path`, each listing every language (and x-default) as an alternate. */
function url(path, { lastmod, changefreq = 'weekly', priority = '0.5' } = {}) {
  const alternates = [...LOCALES.map((locale) => [locale.code, locale.prefix]), ['x-default', LOCALES[0].prefix]].map(
    ([hreflang, prefix]) => `    <xhtml:link rel="alternate" hreflang="${hreflang}" href="${SITE_URL}${prefix}${path}"/>`
  );
  return LOCALES.map((locale) => {
    const lines = [`    <loc>${SITE_URL}${locale.prefix}${path}</loc>`, ...alternates];
    if (lastmod) lines.push(`    <lastmod>${new Date(lastmod).toISOString()}</lastmod>`);
    lines.push(`    <changefreq>${changefreq}</changefreq>`, `    <priority>${priority}</priority>`);
    return `  <url>\n${lines.join('\n')}\n  </url>`;
  }).join('\n');
}

async function main() {
  const entries = [url('/', { changefreq: 'daily', priority: '1.0' }), url('/works', { changefreq: 'daily', priority: '0.9' })];

  const page = await fetchApi(`/works?page=0&size=${MAX_WORKS}`);
  if (!page) {
    console.warn(`[sitemap] Catalog API unreachable at ${API_URL}; writing static routes only.`);
  } else {
    for (const work of page.items) {
      entries.push(url(`/works/${work.id}`, { changefreq: 'weekly', priority: '0.8' }));
      const chapters = (await fetchApi(`/works/${work.id}/chapters`)) ?? [];
      for (const chapter of chapters) {
        entries.push(url(`/read/${chapter.id}`, { lastmod: chapter.publishedAt ?? undefined, changefreq: 'monthly', priority: '0.6' }));
      }
    }
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${entries.join('\n')}\n</urlset>\n`;

  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
  const target = resolve(OUT_DIR, 'sitemap.xml');
  writeFileSync(target, xml, 'utf8');

  // Keep robots.txt's Sitemap line consistent with the deployed origin.
  const robotsPath = resolve(OUT_DIR, 'robots.txt');
  if (existsSync(robotsPath)) {
    const { readFileSync } = await import('node:fs');
    const robots = readFileSync(robotsPath, 'utf8').replace(/^Sitemap:.*$/m, `Sitemap: ${SITE_URL}/sitemap.xml`);
    writeFileSync(robotsPath, robots, 'utf8');
  }

  console.log(`[sitemap] Wrote ${entries.length * LOCALES.length} URLs (${LOCALES.length} languages) to ${target}`);
}

main().catch((error) => {
  console.error('[sitemap] Failed:', error);
  process.exitCode = 0; // never fail the build because of the sitemap
});
