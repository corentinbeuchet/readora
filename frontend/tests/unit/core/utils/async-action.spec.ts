import { ApiError } from '@app/core/api/api-client';
import { AsyncAction, asyncAction } from '@app/core/utils/async-action';

describe('asyncAction', () => {
  let action: AsyncAction;
  let running: Promise<unknown>;
  let finishTask: (value: number) => void;
  let result: unknown;

  it('is busy (with its key) while running, and returns the result', async () => {
    givenAnAction();

    whenIStartATask({ key: 'row-2' });

    thenTheActionIsBusy();
    thenTheBusyKeyIs('row-2');

    await whenTheTaskFinishesWith(42);

    thenTheRunReturned(42);
    thenTheActionIsIdle();
    thenTheBusyKeyIs(null);
    thenTheErrorIs(null);
  });

  it("turns a failure into the API's message, or the fallback, without throwing", async () => {
    givenAnAction({ fallback: 'Could not save.' });

    await whenATaskFailsWith(new ApiError(409, 'Title already exists'));

    thenTheRunReturned(undefined);
    thenTheErrorIs('Title already exists');

    await whenATaskFailsWith(new Error('boom'));

    thenTheErrorIs('Could not save.');

    await whenATaskFailsWith(new Error('boom'), { fallback: 'Could not vote.' });

    thenTheErrorIs('Could not vote.');
    thenTheActionIsIdle();
  });

  it('clears the previous error when a new action starts', async () => {
    givenAnAction();

    whenTheActionIsMarkedFailed('Rate the series first.');

    thenTheErrorIs('Rate the series first.');

    await whenATaskSucceeds();

    thenTheErrorIs(null);
  });

  function givenAnAction(options: { fallback?: string } = {}): void {
    action = asyncAction(options.fallback);
  }

  function whenIStartATask(options: { key: string }): void {
    running = action.run(() => new Promise<number>((resolve) => (finishTask = resolve)), options);
  }

  async function whenTheTaskFinishesWith(value: number): Promise<void> {
    finishTask(value);
    result = await running;
  }

  async function whenATaskFailsWith(error: Error, options: { fallback?: string } = {}): Promise<void> {
    result = await action.run(() => Promise.reject(error), options);
  }

  async function whenATaskSucceeds(): Promise<void> {
    result = await action.run(async () => undefined);
  }

  function whenTheActionIsMarkedFailed(message: string): void {
    action.fail(message);
  }

  function thenTheRunReturned(value: unknown): void {
    expect(result).toBe(value);
  }

  function thenTheActionIsBusy(): void {
    expect(action.busy()).toBe(true);
  }

  function thenTheActionIsIdle(): void {
    expect(action.busy()).toBe(false);
  }

  function thenTheBusyKeyIs(key: string | null): void {
    expect(action.busyKey()).toBe(key);
  }

  function thenTheErrorIs(message: string | null): void {
    expect(action.error()).toBe(message);
  }
});
