import { DestroyRef, Service, computed, inject, signal } from '@angular/core';
import { apply, form, maxLength, required, validate } from '@angular/forms/signals';
import { Demographic, NO_FACTS_DRAFT, Work, WorkFactsDraft, WorkStatus, WorkType } from '@app/core/models/catalog';
import { TeamRef } from '@app/core/models/chapter';
import { WORK_FACTS_SCHEMA } from '@app/shared/forms/work-facts-fields/work-facts-schema';
import { PageUploadItem, createPreviewUrl, isImageFile, revokePreviewUrl } from './file-utils';

export type UploadStep = 'manga' | 'chapter' | 'pages' | 'review' | 'success';
export type PublishingMode = 'DIRECT' | 'SCANLATION';

/** Positive chapter number such as `1`, `10` or `12.5` (backend: `@Positive BigDecimal`, max 50 chars). */
const CHAPTER_NUMBER_PATTERN = /^\d{1,6}(\.\d{1,3})?$/;
export const CHAPTER_NUMBER_ERROR = $localize`:@@upload.chapter.number.invalid:Chapter number must be a positive number such as 1, 10 or 12.5`;
const TITLE_REQUIRED = $localize`:@@upload.series.title.required:Give the series a title`;
export const TITLE_MAX = 255;

/** Normalised chapter number (e.g. `"012.50"` -> `"12.5"`), or `null` when invalid. Never defaults to 1. */
export function parseChapterNumber(raw: string): string | null {
  const value = raw.trim();
  if (!CHAPTER_NUMBER_PATTERN.test(value)) {
    return null;
  }
  const n = Number(value);
  return n > 0 ? String(n) : null;
}

export const GENRE_PRESETS = [
  'Action',
  'Adventure',
  'Comedy',
  'Drama',
  'Fantasy',
  'Horror',
  'Isekai',
  'Mystery',
  'Romance',
  'Sci-Fi',
  'Seinen',
  'Shonen',
  'Slice of Life',
  'Supernatural',
  'Thriller'
];

/** An existing series a team publishes a chapter into (`/upload?workId=&teamId=`): no series is created. */
export interface ExistingSeries {
  work: Work;
  team: TeamRef;
}

/** What the uploader types in the wizard (files are kept aside: cover and pages). */
export interface UploadDraft {
  /** One of the teams I lead, for a new series; `''` gives the series a new team of its own. */
  teamId: string;
  title: string;
  type: WorkType;
  status: WorkStatus;
  author: string;
  demographic: Demographic | '';
  synopsis: string;
  genres: string[];
  facts: WorkFactsDraft;
  chapterNumber: string;
  chapterTitle: string;
  publishingMode: PublishingMode;
}

const NEW_DRAFT: UploadDraft = {
  teamId: '',
  title: '',
  type: 'MANGA',
  status: 'ONGOING',
  author: '',
  demographic: '',
  synopsis: '',
  genres: ['Action'],
  facts: NO_FACTS_DRAFT,
  chapterNumber: '1',
  chapterTitle: '',
  publishingMode: 'DIRECT'
};

/**
 * State of the upload wizard, provided by the upload studio page: the draft (a Signal Form), the cover and page
 * files with their previews, the current step and the message shown above the steps.
 */
@Service({ autoProvided: false })
export class UploadWizard {
  readonly draft = signal<UploadDraft>(NEW_DRAFT);
  readonly form = form(this.draft, (path) => {
    required(path.title, { message: TITLE_REQUIRED });
    validate(path.title, ({ value }) => (value() && !value().trim() ? { kind: 'required', message: TITLE_REQUIRED } : undefined));
    maxLength(path.title, TITLE_MAX);
    maxLength(path.author, 120);
    apply(path.facts, WORK_FACTS_SCHEMA);
    maxLength(path.chapterTitle, TITLE_MAX);
    required(path.chapterNumber, { message: CHAPTER_NUMBER_ERROR });
    validate(path.chapterNumber, ({ value }) =>
      parseChapterNumber(value()) === null ? { kind: 'chapterNumber', message: CHAPTER_NUMBER_ERROR } : undefined
    );
  });

  /** The catalog search of the "Which series?" step, kept while the uploader goes to the new-series form and back. */
  readonly seriesSearch = signal({ text: '' });
  readonly step = signal<UploadStep>('manga');
  readonly pages = signal<PageUploadItem[]>([]);
  private readonly _cover = signal<{ file: File; previewUrl: string } | null>(null);
  readonly cover = this._cover.asReadonly();
  /** Message above the steps (cover type, publishing failures); cleared when moving between steps. */
  private readonly _message = signal<string | null>(null);
  readonly message = this._message.asReadonly();

  readonly seriesValid = computed(() => this.form.title().valid() && this.form.author().valid() && this.form.facts().valid());
  readonly chapterValid = computed(() => this.form.chapterNumber().valid() && this.form.chapterTitle().valid());
  readonly pagesValid = computed(() => this.pages().length > 0);

  constructor() {
    // The wizard owns the cover and page previews (they survive step changes): release them all.
    inject(DestroyRef).onDestroy(() => this.revokePreviews());
  }

  goTo(step: UploadStep): void {
    this._message.set(null);
    this.step.set(step);
  }

  showMessage(message: string | null): void {
    this._message.set(message);
  }

  toggleGenre(genre: string): void {
    this.draft.update((d) => ({ ...d, genres: d.genres.includes(genre) ? d.genres.filter((g) => g !== genre) : [...d.genres, genre] }));
  }

  addGenre(raw: string): boolean {
    const genre = raw.trim();
    if (!genre || this.draft().genres.includes(genre)) {
      return false;
    }
    this.draft.update((d) => ({ ...d, genres: [...d.genres, genre] }));
    return true;
  }

  setPublishingMode(mode: PublishingMode): void {
    this.form.publishingMode().value.set(mode);
  }

  setCover(file: File): void {
    if (!isImageFile(file)) {
      this._message.set($localize`:@@upload.cover.notImage:Cover file must be an image (JPEG, PNG, WebP)`);
      return;
    }
    this.removeCover();
    this._cover.set({ file, previewUrl: createPreviewUrl(file) });
    this._message.set(null);
  }

  removeCover(): void {
    revokePreviewUrl(this._cover()?.previewUrl ?? '');
    this._cover.set(null);
  }

  /** Back to an empty wizard (after a publish): previews are released. */
  reset(): void {
    this.revokePreviews();
    this._cover.set(null);
    this.pages.set([]);
    this.draft.set(NEW_DRAFT);
    this.form().reset();
    this.goTo('manga');
  }

  private revokePreviews(): void {
    revokePreviewUrl(this._cover()?.previewUrl ?? '');
    this.pages().forEach((page) => revokePreviewUrl(page.previewUrl));
  }
}
