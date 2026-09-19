import { defineConfig } from 'vitest/config';

/**
 * Merged by the Angular unit-test builder (`angular.json` test `runnerConfig`). Test isolation that must never depend
 * on a spec remembering its cleanup:
 * - `restoreMocks`: every `vi.spyOn` is restored before the next test (a leaked spy can't change another test);
 * - `unstubGlobals` / `unstubEnvs`: every `vi.stubGlobal` / `vi.stubEnv` is undone before the next test.
 * Fake timers are not covered: call `vi.useRealTimers()` in `afterEach` wherever a spec fakes them.
 * `VITEST_SHUFFLE=1` (`npm run test:shuffle`) runs tests in random order to find order-dependent tests.
 */
export default defineConfig({
  test: {
    restoreMocks: true,
    unstubGlobals: true,
    unstubEnvs: true,
    retry: 0,
    sequence: { shuffle: process.env['VITEST_SHUFFLE'] === '1' }
  }
});
