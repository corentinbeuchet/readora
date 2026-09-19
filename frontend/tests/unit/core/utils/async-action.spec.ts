import { ApiError } from '@app/core/api/api-client';
import { asyncAction } from '@app/core/utils/async-action';

describe('asyncAction', () => {
  it('is busy (with its key) while running, and returns the result', async () => {
    const action = asyncAction();
    let release!: (value: number) => void;
    const running = action.run(() => new Promise<number>((resolve) => (release = resolve)), { key: 'row-2' });
    expect(action.busy()).toBe(true);
    expect(action.busyKey()).toBe('row-2');

    release(42);
    expect(await running).toBe(42);
    expect(action.busy()).toBe(false);
    expect(action.busyKey()).toBeNull();
    expect(action.error()).toBeNull();
  });

  it("turns a failure into the API's message, or the fallback, without throwing", async () => {
    const action = asyncAction('Could not save.');
    expect(await action.run(() => Promise.reject(new ApiError(409, 'Title already exists')))).toBeUndefined();
    expect(action.error()).toBe('Title already exists');

    await action.run(() => Promise.reject(new Error('boom')));
    expect(action.error()).toBe('Could not save.');

    await action.run(() => Promise.reject(new Error('boom')), { fallback: 'Could not vote.' });
    expect(action.error()).toBe('Could not vote.');
    expect(action.busy()).toBe(false);
  });

  it('clears the previous error when a new action starts', async () => {
    const action = asyncAction();
    action.fail('Rate the series first.');
    expect(action.error()).toBe('Rate the series first.');
    await action.run(async () => undefined);
    expect(action.error()).toBeNull();
  });
});
