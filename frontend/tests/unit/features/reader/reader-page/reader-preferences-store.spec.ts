import { TestBed } from '@angular/core/testing';
import { WorkType } from '@app/core/models/readora.models';
import { BrowserStorage } from '@app/core/storage/browser-storage';
import {
  AutoScrollSpeed,
  FitMode,
  READER_PREFERENCES_KEY,
  ReaderBackground,
  ReaderPreferencesStore,
  SeriesLayout,
  defaultLayout
} from '@app/features/reader/reader-page/reader-preferences-store';
import { MemoryStorage } from '../../../test-utils';

interface Settings {
  fit: FitMode;
  background: ReaderBackground;
  doublePage: boolean;
  autoScrollSpeed: AutoScrollSpeed;
  dataSaver: boolean;
}

describe('ReaderPreferencesStore', () => {
  let storage: MemoryStorage;
  let store: ReaderPreferencesStore;

  beforeEach(() => {
    storage = new MemoryStorage();
    TestBed.configureTestingModule({ providers: [{ provide: BrowserStorage, useValue: storage }] });
  });

  it('defaults: manhwa/manhua vertical, manga paged right-to-left, comics paged left-to-right', () => {
    thenTheDefaultLayoutIs('MANHWA', { mode: 'VERTICAL', direction: 'LTR' });
    thenTheDefaultLayoutIs('MANHUA', { mode: 'VERTICAL', direction: 'LTR' });
    thenTheDefaultLayoutIs('MANGA', { mode: 'PAGED', direction: 'RTL' });
    thenTheDefaultLayoutIs('COMIC', { mode: 'PAGED', direction: 'LTR' });
    thenTheDefaultLayoutIs(undefined, { mode: 'VERTICAL', direction: 'LTR' });
  });

  it('keeps choices across sessions', () => {
    givenANewSession();

    whenISaveTheLayout('op', { mode: 'VERTICAL', direction: 'RTL' });
    whenIChoose({ fit: 'HEIGHT', background: 'WHITE', doublePage: true, autoScrollSpeed: 'FAST', dataSaver: true });
    whenIStartANewSession();

    thenTheLayoutIs('op', 'MANGA', { mode: 'VERTICAL', direction: 'RTL' });
    thenTheLayoutIs('sl', 'MANHWA', { mode: 'VERTICAL', direction: 'LTR' });
    thenMySettingsAre({ fit: 'HEIGHT', background: 'WHITE', doublePage: true, autoScrollSpeed: 'FAST', dataSaver: true });
  });

  it('ignores corrupted or unknown stored values', () => {
    givenTheStoredPreferencesAre({ fit: 'ZOOMED', series: { op: { mode: 'SIDEWAYS' } }, doublePage: 'yes' });

    whenIStartANewSession();

    thenTheFitIs('WIDTH');
    thenDoublePageIsOff();
    thenTheLayoutIs('op', 'MANGA', { mode: 'VERTICAL', direction: 'LTR' });
  });

  it('remembers at most 200 series, dropping the oldest', () => {
    givenANewSession();

    whenISaveALayoutForSeriesInOrder(201);

    thenTheNumberOfStoredSeriesIs(200);
    thenSeriesIsNotStored('w-0');
    thenSeriesIsStored('w-200');
  });

  /** A fresh store reads what the previous session saved. */
  function givenANewSession(): void {
    store = TestBed.runInInjectionContext(() => new ReaderPreferencesStore());
  }

  function givenTheStoredPreferencesAre(raw: unknown): void {
    storage.values.set(READER_PREFERENCES_KEY, JSON.stringify(raw));
  }

  function whenIStartANewSession(): void {
    givenANewSession();
  }

  function whenISaveTheLayout(workId: string, layout: SeriesLayout): void {
    store.saveLayout(workId, layout);
  }

  function whenIChoose(settings: Settings): void {
    store.setFit(settings.fit);
    store.setBackground(settings.background);
    store.setDoublePage(settings.doublePage);
    store.setAutoScrollSpeed(settings.autoScrollSpeed);
    store.setDataSaver(settings.dataSaver);
  }

  /** Saves a layout for series `w-0`, `w-1`, … (`count` of them), oldest first. */
  function whenISaveALayoutForSeriesInOrder(count: number): void {
    for (let i = 0; i < count; i++) {
      store.saveLayout(`w-${i}`, { mode: 'PAGED', direction: 'LTR' });
    }
  }

  function thenTheDefaultLayoutIs(type: WorkType | undefined, layout: SeriesLayout): void {
    expect(defaultLayout(type)).toEqual(layout);
  }

  function thenTheLayoutIs(workId: string, type: WorkType, layout: SeriesLayout): void {
    expect(store.layoutFor(workId, type)).toEqual(layout);
  }

  function thenMySettingsAre(settings: Settings): void {
    expect({
      fit: store.fit(),
      background: store.background(),
      doublePage: store.doublePage(),
      autoScrollSpeed: store.autoScrollSpeed(),
      dataSaver: store.dataSaver()
    }).toEqual(settings);
  }

  function thenTheFitIs(fit: FitMode): void {
    expect(store.fit()).toBe(fit);
  }

  function thenDoublePageIsOff(): void {
    expect(store.doublePage()).toBe(false);
  }

  function thenTheNumberOfStoredSeriesIs(count: number): void {
    expect(Object.keys(storedSeries())).toHaveLength(count);
  }

  function thenSeriesIsStored(workId: string): void {
    expect(storedSeries()[workId]).toBeDefined();
  }

  function thenSeriesIsNotStored(workId: string): void {
    expect(storedSeries()[workId]).toBeUndefined();
  }

  function storedSeries(): Record<string, unknown> {
    return storage.read<{ series: Record<string, unknown> }>(READER_PREFERENCES_KEY)!.series;
  }
});
