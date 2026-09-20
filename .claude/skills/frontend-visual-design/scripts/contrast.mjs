#!/usr/bin/env node
/**
 * WCAG 2.2 contrast check of the colour tokens in frontend/src/styles/_tokens.scss, in the light and the dark theme.
 * Run it after changing a colour: `node .claude/skills/frontend-visual-design/scripts/contrast.mjs`. Exits 1 on a failure.
 * Add `--table` to print the ratio of every pair.
 *
 * What it checks (the pairs the app really uses):
 * - text colours on every surface: 4.5:1 (SC 1.4.3);
 * - text on filled accent / danger / success backgrounds: 4.5:1;
 * - control outlines and the focus ring on every surface: 3:1 (SC 1.4.11);
 * - coloured text on its own soft tint (badges, alerts), the tint composited over the surface: 4.5:1.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const TOKENS = resolve(import.meta.dirname, '../../../../frontend/src/styles/_tokens.scss');

const SURFACES = ['bg', 'surface', 'surface-2', 'surface-3'];
const TEXT = ['text', 'muted', 'accent', 'danger', 'success', 'star', 'violet'];
const FILLS = [
  ['on-accent', 'accent'],
  ['on-accent', 'accent-strong'],
  ['on-danger', 'danger'],
  ['on-success', 'success']
];
const OUTLINES = ['border-strong', 'focus-ring'];
/** [text, tint] pairs: the tint is `color-mix(in srgb, var(--base) N%, transparent)` over a surface. */
const TINTED = [
  ['accent', 'accent-soft'],
  ['danger', 'danger-soft'],
  ['success', 'success-soft']
];

const source = readFileSync(TOKENS, 'utf8');
const themed = new Map(); // name -> [light, dark] as [r, g, b]
const aliases = new Map(); // name -> other token name
const tints = new Map(); // name -> { base, alpha }

for (const [, name, light, dark] of source.matchAll(/--([\w-]+):\s*light-dark\(\s*(#[0-9a-f]{3,6})\s*,\s*(#[0-9a-f]{3,6})\s*\)/gi)) {
  themed.set(name, [rgb(light), rgb(dark)]);
}
for (const [, name, target] of source.matchAll(/--([\w-]+):\s*var\(--([\w-]+)\)\s*;/g)) {
  aliases.set(name, target);
}
for (const [, name, base, percent] of source.matchAll(/--([\w-]+):\s*color-mix\(in srgb,\s*var\(--([\w-]+)\)\s*([\d.]+)%,\s*transparent\)/g)) {
  tints.set(name, { base, alpha: Number(percent) / 100 });
}

const failures = [];
const table = [];
let checked = 0;

for (const theme of [0, 1]) {
  for (const surface of SURFACES) {
    for (const text of TEXT) check(theme, text, colour(text, theme), surface, colour(surface, theme), 4.5);
    for (const outline of OUTLINES) check(theme, outline, colour(outline, theme), surface, colour(surface, theme), 3);
  }
  for (const [text, fill] of FILLS) check(theme, text, colour(text, theme), fill, colour(fill, theme), 4.5);
  for (const [text, tint] of TINTED) {
    for (const surface of ['bg', 'surface']) {
      const { base, alpha } = tints.get(tint) ?? fail(`--${tint} is not a color-mix tint`);
      const composite = over(colour(base, theme), alpha, colour(surface, theme));
      check(theme, text, colour(text, theme), `${tint} over ${surface}`, composite, 4.5);
    }
  }
}

if (process.argv.includes('--table')) console.log(table.join('\n'));
console.log(`[contrast] ${checked} pairs checked, ${failures.length} failing.`);
for (const line of failures) console.log(`  ${line}`);
process.exitCode = failures.length ? 1 : 0;

function check(theme, foregroundName, foreground, backgroundName, background, minimum) {
  checked++;
  const ratio = contrast(foreground, background);
  table.push(`${theme === 0 ? 'light' : 'dark '}  ${ratio.toFixed(2).padStart(5)}  (min ${minimum})  --${foregroundName} on --${backgroundName}`);
  if (ratio < minimum) {
    failures.push(`${theme === 0 ? 'light' : 'dark '}  --${foregroundName} on --${backgroundName}: ${ratio.toFixed(2)} (needs ${minimum})`);
  }
}

function colour(name, theme) {
  const resolved = aliases.has(name) ? aliases.get(name) : name;
  const pair = themed.get(resolved) ?? fail(`--${name} is not a light-dark() colour token`);
  return pair[theme];
}

function fail(message) {
  console.error(`[contrast] ${message}`);
  process.exit(1);
}

function rgb(hex) {
  const value = hex.slice(1);
  const full = value.length === 3 ? [...value].map((c) => c + c).join('') : value;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
}

function over(foreground, alpha, background) {
  return foreground.map((channel, i) => channel * alpha + background[i] * (1 - alpha));
}

function luminance([r, g, b]) {
  const [lr, lg, lb] = [r, g, b].map((channel) => {
    const s = channel / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
}

function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
