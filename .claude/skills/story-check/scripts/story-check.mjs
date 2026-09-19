#!/usr/bin/env node
// Checks that every user-story scenario is really verified:
//  - a scenario without @wip/@ui passed in the last Cucumber run (readora-acceptance surefire XML);
//  - a @ui scenario has a frontend Vitest `it(...)` whose name is the exact scenario title;
//  - a @wip scenario is listed so it isn't forgotten.
// Usage: node .claude/skills/story-check/scripts/story-check.mjs   (exit 1 when something is unverified)
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const STORIES = path.join(ROOT, '.readora/context/user-stories');
const REPORT = path.join(ROOT, 'backend/readora-acceptance/target/surefire-reports/TEST-com.readora.acceptance.CucumberAcceptanceTest.xml');
const SPECS = path.join(ROOT, 'frontend/tests/unit');

/** Scenarios with their tags (feature-level tags apply to every scenario). */
function scenarios() {
  const found = [];
  for (const file of readdirSync(STORIES).filter((f) => f.endsWith('.feature')).sort()) {
    let pending = [];
    let featureTags = [];
    for (const line of readFileSync(path.join(STORIES, file), 'utf8').split(/\r?\n/)) {
      const text = line.trim();
      if (text.startsWith('@')) {
        pending.push(...text.split(/\s+/).filter((t) => t.startsWith('@')));
      } else if (/^Feature:/.test(text)) {
        featureTags = pending;
        pending = [];
      } else if (/^Scenario( Outline| Template)?:/.test(text)) {
        found.push({ file, title: text.replace(/^Scenario( Outline| Template)?:\s*/, ''), tags: new Set([...featureTags, ...pending]) });
        pending = [];
      } else if (text && !text.startsWith('#')) {
        pending = [];
      }
    }
  }
  return found;
}

/** Cucumber results by scenario title: passed | failed | skipped. */
function cucumberResults() {
  const results = new Map();
  if (!existsSync(REPORT)) return null;
  const xml = readFileSync(REPORT, 'utf8');
  for (const m of xml.matchAll(/<testcase name="([^"]*)"[^>]*?(\/>|>([\s\S]*?)<\/testcase>)/g)) {
    const title = m[1].replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
    const body = m[3] ?? '';
    const status = /<(failure|error)\b/.test(body) ? 'failed' : /<skipped\b/.test(body) ? 'skipped' : 'passed';
    // Outlines produce one testcase per example: any failure wins.
    if (results.get(title) !== 'failed') results.set(title, status);
  }
  return results;
}

/** All Vitest test names (it / test), unescaped. */
function vitestNames() {
  const names = new Set();
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.spec.ts')) {
        const source = readFileSync(full, 'utf8');
        for (const m of source.matchAll(/\b(?:it|test)(?:\.only)?\(\s*(['"`])((?:\\.|(?!\1).)*)\1/g)) {
          names.add(m[2].replace(/\\(.)/g, '$1'));
        }
      }
    }
  };
  if (existsSync(SPECS)) walk(SPECS);
  return names;
}

const all = scenarios();
const cucumber = cucumberResults();
const vitest = vitestNames();
const problems = [];
const wip = [];
let backendOk = 0;
let uiOk = 0;

for (const s of all) {
  const where = `${s.file}: "${s.title}"`;
  if (s.tags.has('@wip')) {
    wip.push(where);
  } else if (s.tags.has('@ui')) {
    if (vitest.has(s.title)) uiOk++;
    else problems.push(`@ui without a Vitest it('${s.title}')  (${s.file})`);
  } else if (cucumber) {
    const status = cucumber.get(s.title);
    if (status === 'passed') backendOk++;
    else problems.push(`Cucumber ${status ?? 'did not run'}: ${where}`);
  }
}

console.log(`Scenarios: ${all.length} (${backendOk} passed in Cucumber, ${uiOk} @ui with a Vitest test, ${wip.length} @wip)`);
if (!cucumber) {
  problems.push(`No Cucumber report at ${path.relative(ROOT, REPORT)}: run the backend verify first`);
} else {
  const newestFeature = Math.max(...readdirSync(STORIES).map((f) => statSync(path.join(STORIES, f)).mtimeMs));
  if (statSync(REPORT).mtimeMs < newestFeature) {
    console.log('WARN  the Cucumber report is older than a .feature file: re-run the backend verify for current results');
  }
}
for (const w of wip) console.log(`WIP   ${w}`);
for (const p of problems) console.log(`FAIL  ${p}`);
console.log(problems.length === 0 ? 'OK    every non-@wip scenario is verified' : `\n${problems.length} scenario(s) unverified`);
process.exit(problems.length === 0 ? 0 : 1);
