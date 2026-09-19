import { Service, computed, inject, signal } from '@angular/core';
import { WorkType } from '@app/core/models/catalog';
import { BrowserStorage } from '@app/core/storage/browser-storage';

export type ViewMode = 'VERTICAL' | 'PAGED';
export type ReadingDirection = 'LTR' | 'RTL';
export type FitMode = 'WIDTH' | 'HEIGHT' | 'ORIGINAL';
export type ReaderBackground = 'BLACK' | 'GRAY' | 'WHITE';
export type AutoScrollSpeed = 'SLOW' | 'MEDIUM' | 'FAST';

export interface SeriesLayout {
  mode: ViewMode;
  direction: ReadingDirection;
}

export interface ReaderPreferences {
  /** Layout chosen per series (work id), most recent last. */
  series: Record<string, SeriesLayout>;
  fit: FitMode;
  background: ReaderBackground;
  doublePage: boolean;
  autoScrollSpeed: AutoScrollSpeed;
  /** Lighter page images to save mobile data (US-07). */
  dataSaver: boolean;
}

export const READER_PREFERENCES_KEY = 'readora.reader.preferences';
/** Bounds what we keep in localStorage. */
const MAX_REMEMBERED_SERIES = 200;

const DEFAULTS: ReaderPreferences = {
  series: {},
  fit: 'WIDTH',
  background: 'BLACK',
  doublePage: false,
  autoScrollSpeed: 'MEDIUM',
  dataSaver: false
};

/**
 * How a format is read by default (US-07, like Mihon / MangaDex): webtoon-style manhwa and manhua scroll vertically,
 * Japanese manga turn pages right to left, western comics turn pages left to right.
 */
export function defaultLayout(type: WorkType | undefined): SeriesLayout {
  switch (type) {
    case 'MANGA':
      return { mode: 'PAGED', direction: 'RTL' };
    case 'COMIC':
      return { mode: 'PAGED', direction: 'LTR' };
    default:
      return { mode: 'VERTICAL', direction: 'LTR' };
  }
}

/** Reader settings kept in the browser: layout per series, and fit / background / double page / auto-scroll / data saver. */
@Service()
export class ReaderPreferencesStore {
  private readonly storage = inject(BrowserStorage);
  private readonly _prefs = signal<ReaderPreferences>(sanitize(this.storage.read<Partial<ReaderPreferences>>(READER_PREFERENCES_KEY)));

  readonly fit = computed(() => this._prefs().fit);
  readonly background = computed(() => this._prefs().background);
  readonly doublePage = computed(() => this._prefs().doublePage);
  readonly autoScrollSpeed = computed(() => this._prefs().autoScrollSpeed);
  readonly dataSaver = computed(() => this._prefs().dataSaver);

  /** The layout the reader chose for this series, or the default for its format. */
  layoutFor(workId: string, type: WorkType | undefined): SeriesLayout {
    return this._prefs().series[workId] ?? defaultLayout(type);
  }

  saveLayout(workId: string, layout: SeriesLayout): void {
    this.update((prefs) => {
      const series = { ...prefs.series };
      delete series[workId];
      series[workId] = layout;
      const ids = Object.keys(series);
      for (const oldest of ids.slice(0, Math.max(0, ids.length - MAX_REMEMBERED_SERIES))) {
        delete series[oldest];
      }
      return { ...prefs, series };
    });
  }

  setFit(fit: FitMode): void {
    this.update((prefs) => ({ ...prefs, fit }));
  }

  setBackground(background: ReaderBackground): void {
    this.update((prefs) => ({ ...prefs, background }));
  }

  setDoublePage(doublePage: boolean): void {
    this.update((prefs) => ({ ...prefs, doublePage }));
  }

  setAutoScrollSpeed(autoScrollSpeed: AutoScrollSpeed): void {
    this.update((prefs) => ({ ...prefs, autoScrollSpeed }));
  }

  setDataSaver(dataSaver: boolean): void {
    this.update((prefs) => ({ ...prefs, dataSaver }));
  }

  private update(change: (prefs: ReaderPreferences) => ReaderPreferences): void {
    this._prefs.update(change);
    this.storage.write(READER_PREFERENCES_KEY, this._prefs());
  }
}

function oneOf<T extends string>(allowed: readonly T[], value: unknown, fallback: T): T {
  return allowed.find((candidate) => candidate === value) ?? fallback;
}

/** Stored data may be old or edited by hand: keep only valid values. */
function sanitize(stored: Partial<ReaderPreferences> | null): ReaderPreferences {
  if (!stored || typeof stored !== 'object') {
    return DEFAULTS;
  }
  const series: Record<string, SeriesLayout> = {};
  for (const [workId, layout] of Object.entries(stored.series ?? {})) {
    if (layout && typeof layout === 'object') {
      series[workId] = {
        mode: oneOf(['VERTICAL', 'PAGED'] as const, layout.mode, 'VERTICAL'),
        direction: oneOf(['LTR', 'RTL'] as const, layout.direction, 'LTR')
      };
    }
  }
  return {
    series,
    fit: oneOf(['WIDTH', 'HEIGHT', 'ORIGINAL'] as const, stored.fit, DEFAULTS.fit),
    background: oneOf(['BLACK', 'GRAY', 'WHITE'] as const, stored.background, DEFAULTS.background),
    doublePage: stored.doublePage === true,
    autoScrollSpeed: oneOf(['SLOW', 'MEDIUM', 'FAST'] as const, stored.autoScrollSpeed, DEFAULTS.autoScrollSpeed),
    dataSaver: stored.dataSaver === true
  };
}
