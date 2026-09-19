import { DOCUMENT } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BrowserStorage } from '@app/core/storage/browser-storage';

describe('BrowserStorage', () => {
  let storage: BrowserStorage;
  let localValues: Map<string, string>;
  let writeError: unknown;

  it('stores JSON in localStorage', () => {
    givenAWorkingLocalStorage();

    whenIWrite('k', { a: 1 });

    thenLocalStorageHolds('k', '{"a":1}');
    thenReadingGives('k', { a: 1 });
  });

  it('works without a window (server rendering): reads nothing, drops writes', () => {
    givenThereIsNoWindow();

    whenIWrite('k', 1);

    thenReadingGives('k', null);
  });

  it('survives blocked storage, a full quota and unreadable JSON', () => {
    givenLocalStorageIsBlocked();

    thenReadingGives('k', null);

    givenLocalStorageIsFullAndHolds('{not json');

    whenIWrite('k', 1);

    thenTheWriteDidNotThrow();
    thenReadingGives('k', null);
  });

  function givenAWorkingLocalStorage(): void {
    localValues = new Map<string, string>();
    givenTheWindowIs({
      localStorage: { getItem: (k: string) => localValues.get(k) ?? null, setItem: (k: string, v: string) => localValues.set(k, v) }
    });
  }

  function givenThereIsNoWindow(): void {
    givenTheWindowIs(null);
  }

  function givenLocalStorageIsBlocked(): void {
    givenTheWindowIs({
      get localStorage(): Storage {
        throw new DOMException('blocked', 'SecurityError');
      }
    });
  }

  function givenLocalStorageIsFullAndHolds(raw: string): void {
    TestBed.resetTestingModule();
    givenTheWindowIs({
      localStorage: {
        getItem: () => raw,
        setItem: () => {
          throw new DOMException('full', 'QuotaExceededError');
        }
      }
    });
  }

  function givenTheWindowIs(defaultView: unknown): void {
    TestBed.configureTestingModule({ providers: [{ provide: DOCUMENT, useValue: { defaultView } }] });
    storage = TestBed.inject(BrowserStorage);
  }

  function whenIWrite(key: string, value: unknown): void {
    writeError = undefined;
    try {
      storage.write(key, value);
    } catch (error) {
      writeError = error;
    }
  }

  function thenLocalStorageHolds(key: string, raw: string): void {
    expect(localValues.get(key)).toBe(raw);
  }

  function thenReadingGives(key: string, value: unknown): void {
    expect(storage.read(key)).toEqual(value);
  }

  function thenTheWriteDidNotThrow(): void {
    expect(writeError).toBeUndefined();
  }
});
