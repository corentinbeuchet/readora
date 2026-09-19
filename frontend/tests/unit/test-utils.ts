import { Component, EnvironmentProviders, Provider } from '@angular/core';
import { Routes } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ApiResponse } from '@app/core/models/readora.models';
import { environment } from '../../src/environments/environment';

/** API root the app calls in tests (the `API_BASE_URL` default). */
export const API = environment.apiUrl;

/** Empty page for routes a test navigates to without caring what renders. */
@Component({ template: '' })
export class BlankPage {}

/** Every URL resolves (to `BlankPage`), so specs can assert `router.url` after a real navigation. */
export const ANY_URL: Routes = [{ path: '**', component: BlankPage }];

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
