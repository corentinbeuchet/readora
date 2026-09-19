import { DOCUMENT, Service, effect, inject, signal } from '@angular/core';
import { BrowserStorage } from '@app/core/storage/browser-storage';

export type ThemePreference = 'system' | 'light' | 'dark';

/** Also read by the inline script in `index.html`, which applies the choice before the first paint. */
export const THEME_KEY = 'readora.theme';

const PREFERENCES: readonly ThemePreference[] = ['system', 'light', 'dark'];

/** A stored or submitted value as a preference; anything unknown means "follow the device". */
export function toThemePreference(value: unknown): ThemePreference {
  return PREFERENCES.find((preference) => preference === value) ?? 'system';
}

/**
 * Light / dark choice, kept in the browser. "system" leaves `<html>` without `data-theme`, so the CSS follows
 * `prefers-color-scheme` (`styles/_tokens.scss`); "light" or "dark" pins it.
 */
@Service()
export class ThemeStore {
  private readonly storage = inject(BrowserStorage);
  private readonly root = inject(DOCUMENT).documentElement;
  private readonly _preference = signal(toThemePreference(this.storage.read(THEME_KEY)));
  readonly preference = this._preference.asReadonly();

  constructor() {
    effect(() => {
      const preference = this._preference();
      if (preference === 'system') {
        this.root.removeAttribute('data-theme');
      } else {
        this.root.setAttribute('data-theme', preference);
      }
    });
  }

  setPreference(preference: ThemePreference): void {
    this._preference.set(preference);
    this.storage.write(THEME_KEY, preference);
  }
}
