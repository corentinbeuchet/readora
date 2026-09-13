import { ComponentFixture } from '@angular/core/testing';

/**
 * Flushes pending microtasks and runs change detection.
 *
 * `fixture.whenStable()` never resolves while an `httpResource` request is in flight, so
 * resource-driven components must be settled with plain microtask ticks instead.
 */
export async function settle(fixture: ComponentFixture<unknown>, ticks = 3): Promise<void> {
  for (let i = 0; i < ticks; i++) {
    await Promise.resolve();
    fixture.detectChanges();
  }
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  fixture.detectChanges();
}
