#!/usr/bin/env node
/**
 * Runs the Playwright suite against staging, on any OS (Windows cmd/PowerShell included: no POSIX
 * `VAR=value cmd` syntax). `PLAYWRIGHT_BASE_URL` wins when already set (CI); extra args are passed
 * through, e.g. `npm run e2e:staging -- --project=chromium`.
 */
import { spawnSync } from 'node:child_process';

const env = { ...process.env, PLAYWRIGHT_BASE_URL: process.env.PLAYWRIGHT_BASE_URL || 'https://staging.readora.com' };
const result = spawnSync('npx', ['playwright', 'test', ...process.argv.slice(2)], {
  stdio: 'inherit',
  env,
  // npx is a .cmd shim on Windows.
  shell: process.platform === 'win32'
});
process.exit(result.status ?? 1);
