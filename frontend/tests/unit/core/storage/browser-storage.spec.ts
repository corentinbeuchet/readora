import { DOCUMENT } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BrowserStorage } from '@app/core/storage/browser-storage';

function withDocument(defaultView: unknown): BrowserStorage {
  TestBed.configureTestingModule({ providers: [{ provide: DOCUMENT, useValue: { defaultView } }] });
  return TestBed.inject(BrowserStorage);
}

describe('BrowserStorage', () => {
  it('stores JSON in localStorage', () => {
    const values = new Map<string, string>();
    const storage = withDocument({
      localStorage: { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => values.set(k, v) }
    });

    storage.write('k', { a: 1 });
    expect(values.get('k')).toBe('{"a":1}');
    expect(storage.read('k')).toEqual({ a: 1 });
  });

  it('works without a window (server rendering): reads nothing, drops writes', () => {
    const storage = withDocument(null);
    storage.write('k', 1);
    expect(storage.read('k')).toBeNull();
  });

  it('survives blocked storage, a full quota and unreadable JSON', () => {
    const blocked = withDocument({
      get localStorage(): Storage {
        throw new DOMException('blocked', 'SecurityError');
      }
    });
    expect(blocked.read('k')).toBeNull();

    TestBed.resetTestingModule();
    const full = withDocument({
      localStorage: {
        getItem: () => '{not json',
        setItem: () => {
          throw new DOMException('full', 'QuotaExceededError');
        }
      }
    });
    expect(() => full.write('k', 1)).not.toThrow();
    expect(full.read('k')).toBeNull();
  });
});
