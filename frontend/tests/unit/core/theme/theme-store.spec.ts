import { DOCUMENT } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BrowserStorage } from '@app/core/storage/browser-storage';
import { THEME_KEY, ThemePreference, ThemeStore } from '@app/core/theme/theme-store';
import { MemoryStorage } from '../../test-utils';

describe('ThemeStore', () => {
  let storage: MemoryStorage;
  let store: ThemeStore;

  beforeEach(() => {
    storage = new MemoryStorage();
    TestBed.configureTestingModule({ providers: [{ provide: BrowserStorage, useValue: storage }] });
  });

  afterEach(() => TestBed.inject(DOCUMENT).documentElement.removeAttribute('data-theme'));

  it('is dark until the reader picks a theme', () => {
    givenTheStoreStarts();

    thenThePreferenceIs('dark');
    thenThePageThemeIs('dark');
  });

  it('applies and remembers an explicit choice, and System follows the device again', () => {
    givenTheStoreStarts();

    whenIChoose('light');

    thenThePageThemeIs('light');
    thenTheSavedChoiceIs('light');

    whenIChoose('system');

    thenThePageThemeIs(null);
    thenTheSavedChoiceIs('system');
  });

  it.each<[string, ThemePreference, string | null]>([
    ['"light"', 'light', 'light'],
    ['"system"', 'system', null],
    ['"purple"', 'dark', 'dark'],
    ['{not json', 'dark', 'dark']
  ])('restores the saved value %s as %s', (raw, preference, pageTheme) => {
    givenTheSavedValueIs(raw);

    givenTheStoreStarts();

    thenThePreferenceIs(preference);
    thenThePageThemeIs(pageTheme);
  });

  function givenTheSavedValueIs(raw: string): void {
    storage.values.set(THEME_KEY, raw);
  }

  function givenTheStoreStarts(): void {
    store = TestBed.inject(ThemeStore);
    TestBed.tick();
  }

  function whenIChoose(preference: ThemePreference): void {
    store.setPreference(preference);
    TestBed.tick();
  }

  function thenThePreferenceIs(preference: ThemePreference): void {
    expect(store.preference()).toBe(preference);
  }

  function thenThePageThemeIs(theme: string | null): void {
    expect(TestBed.inject(DOCUMENT).documentElement.getAttribute('data-theme')).toBe(theme);
  }

  function thenTheSavedChoiceIs(preference: ThemePreference): void {
    expect(storage.read(THEME_KEY)).toBe(preference);
  }
});
