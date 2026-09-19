import { ApplicationRef, Component, EnvironmentProviders, Provider } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Routes } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ApiResponse } from '@app/core/models/api';
import { BrowserStorage } from '@app/core/storage/browser-storage';
import { environment } from '../../src/environments/environment';

/** API root the app calls in tests (the `API_BASE_URL` default). */
export const API = environment.apiUrl;

/** "Now" for tests that show relative times: fixtures are built from it, never from the real clock. */
export const FIXED_NOW = new Date('2026-09-19T12:00:00Z');

/**
 * Fakes only `Date` (setTimeout stays real, so `settle()` keeps working) and sets it to `now`.
 * Pair with `vi.useRealTimers()` in `afterEach`.
 */
export function freezeDate(now: Date = FIXED_NOW): void {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(now);
}

/** Empty page for routes a test navigates to without caring what renders. */
@Component({ template: '' })
export class BlankPage {}

/** Every URL resolves (to `BlankPage`), so specs can assert `router.url` after a real navigation. */
export const ANY_URL: Routes = [{ path: '**', component: BlankPage }];

/**
 * In-memory `BrowserStorage` (jsdom's localStorage isn't reliable under Node 26). Values are stored as JSON strings,
 * like the real storage: a test can plant a raw (even corrupt) value in `values` and assert on `read()`.
 */
export class MemoryStorage implements Pick<BrowserStorage, 'available' | 'read' | 'write'> {
  readonly available = true;
  readonly values = new Map<string, string>();

  read<T>(key: string): T | null {
    const raw = this.values.get(key);
    try {
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  }

  write(key: string, value: unknown): void {
    this.values.set(key, JSON.stringify(value));
  }
}

/** `HttpClient` backed by `HttpTestingController`. */
export function provideHttpTesting(): (Provider | EnvironmentProviders)[] {
  return [provideHttpClient(), provideHttpClientTesting()];
}

/** A successful API envelope, as the backend sends it. */
export function ok<T>(data: T): ApiResponse<T> {
  return { success: true, data, error: null };
}

/** A failed API envelope (`success: false`) carrying `error`. */
export function fail(error: string): ApiResponse<null> {
  return { success: false, data: null, error };
}

/**
 * For services and resources without a component (angular.dev http-resource testing recipe): run this after the
 * `flush()` of a request; `TestBed.tick()` beforehand makes the resource send it. Components use `settle()`.
 */
export async function resourcesStable(): Promise<void> {
  await TestBed.inject(ApplicationRef).whenStable();
}

/**
 * Flushes pending microtasks and runs change detection on a `ComponentFixture` or a `RouterTestingHarness`.
 *
 * `fixture.whenStable()` never resolves while an `httpResource` request is in flight, so
 * resource-driven components must be settled with plain microtask ticks instead.
 */
export async function settle(target: { detectChanges(): void }, ticks = 3): Promise<void> {
  for (let i = 0; i < ticks; i++) {
    await Promise.resolve();
    target.detectChanges();
  }
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  target.detectChanges();
}
