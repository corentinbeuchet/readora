// Runs the unit tests once in random order (vitest-base.config.ts reads VITEST_SHUFFLE), to find tests that only
// pass in their usual order. Cross-platform replacement for `VITEST_SHUFFLE=1 ng test --watch=false`.
import { spawnSync } from 'node:child_process';

const result = spawnSync('npx', ['ng', 'test', '--watch=false', ...process.argv.slice(2)], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: { ...process.env, VITEST_SHUFFLE: '1' }
});
process.exit(result.status ?? 1);
