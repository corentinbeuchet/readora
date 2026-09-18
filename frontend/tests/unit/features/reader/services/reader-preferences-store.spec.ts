import { TestBed } from '@angular/core/testing';
import { BrowserStorage } from '@app/core/storage/browser-storage';
import { READER_PREFERENCES_KEY, ReaderPreferencesStore, defaultLayout } from '@app/features/reader/services/reader-preferences-store';

/** In-memory stand-in for the browser storage (jsdom here has no usable localStorage). */
class MemoryStorage {
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

describe('ReaderPreferencesStore', () => {
  let storage: MemoryStorage;

  beforeEach(() => {
    storage = new MemoryStorage();
    TestBed.configureTestingModule({ providers: [{ provide: BrowserStorage, useValue: storage }] });
  });

  /** A fresh store reads what the previous session saved. */
  const newSession = (): ReaderPreferencesStore => TestBed.runInInjectionContext(() => new ReaderPreferencesStore());

  it('defaults: manhwa/manhua vertical, manga paged right-to-left, comics paged left-to-right', () => {
    expect(defaultLayout('MANHWA')).toEqual({ mode: 'VERTICAL', direction: 'LTR' });
    expect(defaultLayout('MANHUA')).toEqual({ mode: 'VERTICAL', direction: 'LTR' });
    expect(defaultLayout('MANGA')).toEqual({ mode: 'PAGED', direction: 'RTL' });
    expect(defaultLayout('COMIC')).toEqual({ mode: 'PAGED', direction: 'LTR' });
    expect(defaultLayout(undefined)).toEqual({ mode: 'VERTICAL', direction: 'LTR' });
  });

  it('keeps choices across sessions', () => {
    const first = newSession();
    first.saveLayout('op', { mode: 'VERTICAL', direction: 'RTL' });
    first.setFit('HEIGHT');
    first.setBackground('WHITE');
    first.setDoublePage(true);
    first.setAutoScrollSpeed('FAST');

    const next = newSession();
    expect(next.layoutFor('op', 'MANGA')).toEqual({ mode: 'VERTICAL', direction: 'RTL' });
    expect(next.layoutFor('sl', 'MANHWA')).toEqual({ mode: 'VERTICAL', direction: 'LTR' });
    expect([next.fit(), next.background(), next.doublePage(), next.autoScrollSpeed()]).toEqual(['HEIGHT', 'WHITE', true, 'FAST']);
  });

  it('ignores corrupted or unknown stored values', () => {
    storage.values.set(READER_PREFERENCES_KEY, JSON.stringify({ fit: 'ZOOMED', series: { op: { mode: 'SIDEWAYS' } }, doublePage: 'yes' }));
    const store = newSession();

    expect(store.fit()).toBe('WIDTH');
    expect(store.doublePage()).toBe(false);
    expect(store.layoutFor('op', 'MANGA')).toEqual({ mode: 'VERTICAL', direction: 'LTR' });
  });

  it('remembers at most 200 series, dropping the oldest', () => {
    const store = newSession();
    for (let i = 0; i <= 200; i++) {
      store.saveLayout(`w-${i}`, { mode: 'PAGED', direction: 'LTR' });
    }
    const saved = storage.read<{ series: Record<string, unknown> }>(READER_PREFERENCES_KEY)!;
    expect(Object.keys(saved.series)).toHaveLength(200);
    expect(saved.series['w-0']).toBeUndefined();
    expect(saved.series['w-200']).toBeDefined();
  });
});
