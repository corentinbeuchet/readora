#!/usr/bin/env node
// Runs Readora's checks and prints one summary line per suite, with failures quoted.
// Usage: node .claude/skills/verify/scripts/verify.mjs [all|backend|frontend] [--no-build]
// Full logs go to the OS temp dir (path printed); the last line is a ready-made commit "Verify:" line.
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const args = process.argv.slice(2);
const target = args.find((a) => !a.startsWith('--')) ?? 'all';
const skipBuild = args.includes('--no-build');
const logDir = os.tmpdir();
const results = [];
const stripAnsi = (s) => s.replace(/\u001b\[[0-9;]*m/g, '');

function run(label, command, cwd, env = process.env) {
  const started = Date.now();
  const r = spawnSync(command, { cwd, env, shell: true, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  const output = stripAnsi(`${r.stdout ?? ''}${r.stderr ?? ''}`);
  const log = path.join(logDir, `readora-verify-${label.replace(/\W+/g, '-')}.log`);
  writeFileSync(log, output);
  return { ok: r.status === 0, output, log, seconds: Math.round((Date.now() - started) / 1000) };
}

/// mvn on PATH, else $MAVEN_CMD, else IntelliJ's bundled Maven (the usual case on this Windows machine).
function findMaven() {
  if (process.env.MAVEN_CMD) return `"${process.env.MAVEN_CMD}"`;
  if (spawnSync('mvn -v', { shell: true, stdio: 'ignore' }).status === 0) return 'mvn';
  const jetbrains = 'C:/Program Files/JetBrains';
  if (existsSync(jetbrains)) {
    for (const ide of readdirSync(jetbrains).sort().reverse()) {
      const cmd = path.join(jetbrains, ide, 'plugins/maven-plugin/lib/maven3/bin/mvn.cmd');
      if (existsSync(cmd)) return `"${cmd}"`;
    }
  }
  return null;
}

/// JAVA_HOME pointing at a JDK 25 (backend needs Java 25): keep a good one, else pick ~/.jdks/*25*.
function javaHome() {
  const current = process.env.JAVA_HOME;
  if (current && /25/.test(current) && existsSync(current)) return current;
  const jdks = path.join(os.homedir(), '.jdks');
  const found = existsSync(jdks) ? readdirSync(jdks).filter((d) => /(^|\D)25(\D|$)/.test(d)).sort().reverse()[0] : undefined;
  return found ? path.join(jdks, found) : current;
}

/// Sums surefire/failsafe .txt reports of every module and lists the failed tests.
function mavenReports() {
  let total = 0, failed = 0, errors = 0, skipped = 0;
  const failures = [];
  const backend = path.join(ROOT, 'backend');
  for (const module of readdirSync(backend)) {
    for (const kind of ['surefire-reports', 'failsafe-reports']) {
      const dir = path.join(backend, module, 'target', kind);
      if (!existsSync(dir)) continue;
      for (const file of readdirSync(dir).filter((f) => f.endsWith('.txt'))) {
        const text = readFileSync(path.join(dir, file), 'utf8');
        const m = text.match(/Tests run: (\d+), Failures: (\d+), Errors: (\d+), Skipped: (\d+)/);
        if (!m) continue;
        total += +m[1]; failed += +m[2]; errors += +m[3]; skipped += +m[4];
        for (const line of text.split('\n').filter((l) => /<<< (FAILURE|ERROR)!/.test(l))) failures.push(line.trim());
      }
    }
  }
  return { total, failed, errors, skipped, failures };
}

function backend() {
  const mvn = findMaven();
  if (!mvn) {
    results.push({ suite: 'backend', ok: false, summary: 'Maven not found (set MAVEN_CMD or put mvn on PATH)' });
    return;
  }
  const env = { ...process.env, JAVA_HOME: javaHome() };
  const r = run('backend', `${mvn} -q -f backend/pom.xml verify`, ROOT, env);
  const reports = mavenReports();
  const buildErrors = r.output.split('\n').filter((l) => /^\[ERROR\] .*(\.java|COMPILATION|Failed to execute)/.test(l)).slice(0, 8);
  results.push({
    suite: 'backend',
    ok: r.ok,
    summary: `mvn verify: ${reports.total} tests, ${reports.failed} failures, ${reports.errors} errors, ${reports.skipped} skipped (${r.seconds}s)`,
    details: [...reports.failures.slice(0, 15), ...(r.ok ? [] : buildErrors)],
    log: r.log
  });
}

function frontend() {
  const cwd = path.join(ROOT, 'frontend');
  const lint = run('frontend-lint', 'npm run lint', cwd);
  results.push({
    suite: 'lint',
    ok: lint.ok,
    summary: lint.ok ? 'npm run lint: clean' : 'npm run lint: errors',
    details: lint.ok ? [] : lint.output.split('\n').filter((l) => /error|warning/i.test(l)).slice(0, 15),
    log: lint.log
  });

  const test = run('frontend-test', 'npm run test:ci', cwd);
  const files = test.output.match(/Test Files\s+(.+)/)?.[1]?.trim() ?? '?';
  const tests = test.output.match(/\n\s*Tests\s+(.+)/)?.[1]?.trim() ?? '?';
  results.push({
    suite: 'test',
    ok: test.ok,
    summary: `ng test: files ${files}; tests ${tests} (${test.seconds}s)`,
    details: test.ok ? [] : test.output.split('\n').filter((l) => /FAIL|AssertionError|×|error TS/.test(l)).slice(0, 15),
    log: test.log
  });

  if (skipBuild) return;
  const build = run('frontend-build', 'npm run build', cwd);
  results.push({
    suite: 'build',
    ok: build.ok,
    summary: build.ok ? `npm run build: OK (${build.seconds}s)` : 'npm run build: FAILED',
    details: build.ok ? [] : build.output.split('\n').filter((l) => /ERROR|error TS|✘/.test(l)).slice(0, 15),
    log: build.log
  });
}

if (target === 'all' || target === 'backend') backend();
if (target === 'all' || target === 'frontend') frontend();

for (const r of results) {
  console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.suite.padEnd(8)} ${r.summary}`);
  for (const d of r.details ?? []) console.log(`        ${d}`);
  if (!r.ok && r.log) console.log(`        full log: ${r.log}`);
}
console.log(`\nVerify: ${results.map((r) => r.summary.replace(/ \(\d+s\)/, '')).join('; ')}`);
process.exit(results.every((r) => r.ok) ? 0 : 1);
