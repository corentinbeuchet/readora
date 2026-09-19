/**
 * Translation files, one per purpose (US-13). `ng extract-i18n` writes a single src/locale/messages.json; this script
 * splits it into src/locale/en/<file>.json (English reference, generated) and checks every translation folder
 * (src/locale/<lang>/, edited by hand) against it.
 *
 *   node scripts/i18n-split.mjs           split the fresh extraction, then check (npm run extract-i18n)
 *   node scripts/i18n-split.mjs --check   check only, from src/locale/en/ (npm run i18n:check, CI)
 *
 * The first segment of a message id picks its file (FILE_OF_PREFIX). Exits 1 on any problem.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const LOCALE_DIR = resolve(ROOT, 'src/locale');
const SOURCE_DIR = resolve(LOCALE_DIR, 'en');
const EXTRACTED = resolve(LOCALE_DIR, 'messages.json');

/** Id prefix (text before the first dot) → file name. A new area of the app gets a line here. */
const FILE_OF_PREFIX = {
  // Shared
  error: 'errors',
  form: 'common',
  time: 'common',
  loadError: 'common',
  seo: 'common',
  shell: 'layout',
  omnisearch: 'layout',
  bell: 'layout',
  // Display names of API codes (core/models)
  workType: 'labels',
  workStatus: 'labels',
  demographic: 'labels',
  taskStatus: 'labels',
  role: 'labels',
  subscriptionPlan: 'labels',
  subscriptionStatus: 'labels',
  bookmarkStatus: 'labels',
  readingStatus: 'labels',
  pageReport: 'labels',
  commentReport: 'labels',
  // One file per feature folder
  auth: 'auth',
  catalog: 'catalog',
  community: 'community',
  discovery: 'discovery',
  library: 'library',
  lists: 'lists',
  moderation: 'moderation',
  profile: 'profile',
  reader: 'reader',
  scanlation: 'scanlation',
  social: 'social',
  subscription: 'subscription',
  upload: 'upload'
};

const problems = [];

/**
 * Placeholders a translation must keep (`{$INTERPOLATION}`, `{$count}`, `{START_TAG_SPAN}` inside plurals), as a set:
 * a translation may repeat one in several plural branches. ICU branch texts (`{public}`) are not placeholders.
 */
function placeholders(text) {
  const found = [...text.matchAll(/\{\$[A-Za-z0-9_]+\}|\{[A-Z][A-Z0-9_]*\}/g)].map((m) => m[0]);
  return [...new Set(found)].sort().join(' ');
}

function fileOf(id) {
  if (/^\d+$/.test(id)) {
    problems.push(`${id}: generated id (a plural nested in a larger message?). Give the message an @@id.`);
    return null;
  }
  const file = FILE_OF_PREFIX[id.split('.')[0]];
  if (!file) problems.push(`${id}: no file for prefix "${id.split('.')[0]}". Add it to FILE_OF_PREFIX in scripts/i18n-split.mjs.`);
  return file ?? null;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function writeJson(path, locale, translations) {
  writeFileSync(path, `${JSON.stringify({ locale, translations }, null, 2)}\n`, 'utf8');
}

/** `{ file: { id: text } }` in the order the messages were extracted. */
function group(translations) {
  const files = {};
  for (const [id, text] of Object.entries(translations)) {
    const file = fileOf(id);
    if (file) (files[file] ??= {})[id] = text;
  }
  return files;
}

function split() {
  if (!existsSync(EXTRACTED)) throw new Error(`${EXTRACTED} not found: run ng extract-i18n first.`);
  const extracted = readJson(EXTRACTED);
  const files = group(extracted.translations);
  rmSync(SOURCE_DIR, { recursive: true, force: true });
  mkdirSync(SOURCE_DIR, { recursive: true });
  for (const [file, translations] of Object.entries(files)) writeJson(resolve(SOURCE_DIR, `${file}.json`), extracted.locale, translations);
  rmSync(EXTRACTED);
  console.log(`[i18n] ${Object.keys(extracted.translations).length} messages in ${Object.keys(files).length} files (src/locale/en/).`);
  return files;
}

function readSource() {
  const files = {};
  for (const name of readdirSync(SOURCE_DIR).filter((n) => n.endsWith('.json'))) {
    files[name.replace(/\.json$/, '')] = readJson(resolve(SOURCE_DIR, name)).translations;
  }
  return files;
}

function check(source) {
  const fileOfId = new Map(Object.entries(source).flatMap(([file, t]) => Object.keys(t).map((id) => [id, file])));
  const angular = readJson(resolve(ROOT, 'angular.json'));
  const locales = Object.values(angular.projects)[0].i18n?.locales ?? {};
  const folders = readdirSync(LOCALE_DIR, { withFileTypes: true }).filter((d) => d.isDirectory() && d.name !== 'en').map((d) => d.name);
  const languages = [...new Set([...folders, ...Object.keys(locales)])];

  for (const lang of languages) {
    const dir = resolve(LOCALE_DIR, lang);
    if (!existsSync(dir)) {
      problems.push(`angular.json builds "${lang}" but src/locale/${lang}/ does not exist.`);
      continue;
    }
    const onDisk = readdirSync(dir).filter((n) => n.endsWith('.json')).sort();
    for (const file of Object.keys(source)) {
      if (!onDisk.includes(`${file}.json`)) problems.push(`${lang}/${file}.json is missing (${Object.keys(source[file]).length} messages).`);
    }
    for (const name of onDisk) {
      const file = name.replace(/\.json$/, '');
      const translations = readJson(resolve(dir, name)).translations;
      for (const [id, text] of Object.entries(translations)) {
        const home = fileOfId.get(id);
        if (!home) problems.push(`${lang}/${name}: "${id}" is not in the app any more (stale).`);
        else if (home !== file) problems.push(`${lang}/${name}: "${id}" belongs in ${lang}/${home}.json.`);
        else if (placeholders(text) !== placeholders(source[home][id])) {
          problems.push(`${lang}/${name}: "${id}" placeholders differ from English (${placeholders(source[home][id]) || 'none'}).`);
        }
      }
      for (const id of Object.keys(source[file] ?? {})) {
        if (!(id in translations)) problems.push(`${lang}/${name}: "${id}" has no translation ("${source[file][id]}").`);
      }
    }
    const configured = [locales[lang]?.translation ?? []].flat().map((p) => p.replace(/^src\/locale\/[^/]+\//, '')).sort();
    if (configured.join() !== onDisk.join()) {
      problems.push(`angular.json i18n.locales.${lang}.translation must list exactly src/locale/${lang}/*.json (${onDisk.join(', ')}).`);
    }
  }
}

const source = process.argv.includes('--check') ? readSource() : split();
check(source);
if (problems.length) {
  console.error(`[i18n] ${problems.length} problem(s):\n  ${problems.join('\n  ')}`);
  process.exitCode = 1;
} else {
  console.log('[i18n] Every translation file is complete and in the right place.');
}
