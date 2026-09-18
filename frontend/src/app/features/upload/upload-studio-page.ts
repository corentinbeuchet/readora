import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { apiErrorMessage } from '@app/core/api/api-client';
import { SeoService } from '@app/core/seo/seo.service';
import { UploadService } from '@app/core/upload/upload.service';
import {
  CreateWorkPayload,
  PageAsset,
  Work,
  WorkStatus,
  WorkType,
} from '@app/core/models/readora.models';
import { PageUploadItem, createPreviewUrl, isImageFile, revokePreviewUrl } from '@app/core/upload/file-utils';
import { PageGridUploader } from './components/page-grid-uploader';

export type UploadStep = 'manga' | 'chapter' | 'pages' | 'review' | 'success';
export type PublishingMode = 'DIRECT' | 'SCANLATION';

/** Positive chapter number such as `1`, `10` or `12.5` (backend: `@Positive BigDecimal`, max 50 chars). */
const CHAPTER_NUMBER_PATTERN = /^\d{1,6}(\.\d{1,3})?$/;
const CHAPTER_NUMBER_ERROR = 'Chapter number must be a positive number such as 1, 10 or 12.5';
const NO_PROJECT_ERROR =
  'No scanlation project exists for this series yet. Create one from the Scanlation workspace, then publish again.';

/** Normalised chapter number (e.g. `"012.50"` -> `"12.5"`), or `null` when invalid. Never defaults to 1. */
export function parseChapterNumber(raw: string): string | null {
  const value = raw.trim();
  if (!CHAPTER_NUMBER_PATTERN.test(value)) {
    return null;
  }
  const n = Number(value);
  return n > 0 ? String(n) : null;
}

/** A failure whose message is written for the user (as opposed to an unexpected exception). */
class UploadFlowError extends Error {}

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
  'Thriller',
];

@Component({
  selector: 'app-upload-studio-page',
  imports: [CommonModule, FormsModule, RouterLink, PageGridUploader],
  templateUrl: './upload-studio-page.html',
  styleUrl: './upload-studio-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UploadStudioPage {
  private readonly uploadService = inject(UploadService);
  private readonly seo = inject(SeoService);

  // Wizard step
  readonly currentStep = signal<UploadStep>('manga');

  // Step 1: Manga details
  readonly title = signal('');
  readonly type = signal<WorkType>('MANGA');
  readonly status = signal<WorkStatus>('ONGOING');
  readonly synopsis = signal('');
  readonly selectedGenres = signal<string[]>(['Action']);
  readonly customGenreInput = signal('');
  readonly coverFile = signal<File | null>(null);
  readonly coverPreviewUrl = signal<string>('');

  // Step 2: Chapter details
  readonly chapterNumber = signal('1');
  readonly chapterTitle = signal('');
  readonly publishingMode = signal<PublishingMode>('DIRECT');

  // Step 3: Chapter pages
  readonly pages = signal<PageUploadItem[]>([]);

  // Submission state
  readonly isSubmitting = signal(false);
  readonly uploadProgress = signal(0);
  readonly uploadStatusText = signal('');
  readonly errorMessage = signal<string | null>(null);

  // Result state
  readonly createdWork = signal<Work | null>(null);
  readonly createdChapterId = signal<string | null>(null);
  readonly createdProjectId = signal<string | null>(null);
  /** CDN URL of the uploaded cover, kept so a retry does not upload it again. */
  private readonly uploadedCoverUrl = signal<string | null>(null);

  readonly availableGenres = GENRE_PRESETS;

  // Validation computed signals
  readonly isMangaStepValid = computed(() => {
    return this.title().trim().length > 0 && this.title().trim().length <= 255;
  });

  readonly isChapterStepValid = computed(() => parseChapterNumber(this.chapterNumber()) !== null);

  readonly isPagesStepValid = computed(() => {
    return this.pages().length > 0;
  });

  constructor() {
    this.seo.update({
      title: 'Upload Studio — Readora',
      description: 'Create manga series, upload chapter pages, and publish directly or via scanlation pipeline.',
      path: '/upload',
    });
    // The wizard owns the cover and page previews (they survive step changes): release them all.
    inject(DestroyRef).onDestroy(() => this.revokePreviews());
  }

  private revokePreviews(): void {
    revokePreviewUrl(this.coverPreviewUrl());
    this.pages().forEach((page) => revokePreviewUrl(page.previewUrl));
  }

  // Genre management
  toggleGenre(genre: string): void {
    const current = this.selectedGenres();
    if (current.includes(genre)) {
      this.selectedGenres.set(current.filter((g) => g !== genre));
    } else {
      this.selectedGenres.set([...current, genre]);
    }
  }

  addCustomGenre(): void {
    const custom = this.customGenreInput().trim();
    if (custom && !this.selectedGenres().includes(custom)) {
      this.selectedGenres.update((genres) => [...genres, custom]);
      this.customGenreInput.set('');
    }
  }

  // Cover image management
  onCoverSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      this.setCoverFile(input.files[0]);
    }
  }

  onCoverDrop(event: DragEvent): void {
    event.preventDefault();
    if (event.dataTransfer?.files && event.dataTransfer.files[0]) {
      this.setCoverFile(event.dataTransfer.files[0]);
    }
  }

  private setCoverFile(file: File): void {
    if (isImageFile(file)) {
      revokePreviewUrl(this.coverPreviewUrl());
      this.coverFile.set(file);
      this.uploadedCoverUrl.set(null);
      this.coverPreviewUrl.set(createPreviewUrl(file));
      this.errorMessage.set(null);
    } else {
      this.errorMessage.set('Cover file must be an image (JPEG, PNG, WebP)');
    }
  }

  removeCover(): void {
    revokePreviewUrl(this.coverPreviewUrl());
    this.coverFile.set(null);
    this.uploadedCoverUrl.set(null);
    this.coverPreviewUrl.set('');
  }

  // Wizard Navigation
  goToStep(step: UploadStep): void {
    this.errorMessage.set(null);
    this.currentStep.set(step);
  }

  nextFromManga(): void {
    if (!this.isMangaStepValid()) {
      this.errorMessage.set('Please provide a valid Manga title (1-255 characters)');
      return;
    }
    this.goToStep('chapter');
  }

  nextFromChapter(): void {
    if (!this.isChapterStepValid()) {
      this.errorMessage.set(CHAPTER_NUMBER_ERROR);
      return;
    }
    this.goToStep('pages');
  }

  nextFromPages(): void {
    if (!this.isPagesStepValid()) {
      this.errorMessage.set('Please add at least one page to publish');
      return;
    }
    this.goToStep('review');
  }

  // Final Publish Workflow.
  // Retry-safe: every step records what it created (cover URL, Work, uploaded pages, chapter/task),
  // so a retry after a partial failure resumes where it stopped instead of duplicating entities.
  async submitUpload(): Promise<void> {
    if (!this.isMangaStepValid() || !this.isChapterStepValid() || !this.isPagesStepValid()) {
      this.errorMessage.set('Please complete all required fields before publishing.');
      return;
    }
    const chapterNumber = parseChapterNumber(this.chapterNumber());
    if (chapterNumber === null) {
      this.errorMessage.set(CHAPTER_NUMBER_ERROR);
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set(null);
    this.uploadProgress.set(5);

    try {
      const work = await this.ensureWork();

      const pending = this.pages().filter((p) => p.status !== 'done').length;
      this.uploadProgress.set(40);
      this.uploadStatusText.set(`Uploading ${pending} chapter pages…`);
      const uploadedPages = await firstValueFrom(
        this.uploadService.uploadPagesBatch(this.pages(), `scans/${work.id}/c${chapterNumber}`, 3, (completed, total, item) => {
          this.pages.update((pages) => pages.map((p) => (p.id === item.id ? item : p)));
          this.uploadProgress.set(40 + Math.floor((completed / total) * 45));
          this.uploadStatusText.set(`Uploaded ${completed}/${total} pages…`);
        })
      );
      const failed = uploadedPages.filter((p) => p.status !== 'done');
      if (failed.length > 0) {
        this.errorMessage.set(
          `${failed.length} of ${uploadedPages.length} pages failed to upload (${failed[0].error ?? 'upload failed'}). ` +
            'Publish again to retry only the failed pages.'
        );
        return;
      }

      this.uploadProgress.set(90);
      if (this.publishingMode() === 'DIRECT') {
        await this.publishDirect(work, uploadedPages, chapterNumber);
      } else {
        await this.createScanlationTask(work, uploadedPages, chapterNumber);
      }

      this.uploadProgress.set(100);
      this.uploadStatusText.set('Upload completed successfully!');
      this.currentStep.set('success');
    } catch (err: unknown) {
      this.errorMessage.set(
        err instanceof UploadFlowError
          ? err.message
          : apiErrorMessage(err, 'An unexpected error occurred during upload. Please try again.')
      );
    } finally {
      this.isSubmitting.set(false);
    }
  }

  /** Uploads the cover and creates the Work once; later attempts reuse both. */
  private async ensureWork(): Promise<Work> {
    const existing = this.createdWork();
    if (existing) {
      return existing;
    }

    const cover = this.coverFile();
    if (cover && !this.uploadedCoverUrl()) {
      this.uploadStatusText.set('Uploading cover image…');
      const coverRes = await firstValueFrom(this.uploadService.uploadCover(cover));
      this.uploadedCoverUrl.set(coverRes.cdnUrl);
    }

    this.uploadProgress.set(20);
    this.uploadStatusText.set('Creating series in catalog…');
    const workPayload: CreateWorkPayload = {
      title: this.title().trim(),
      synopsis: this.synopsis().trim(),
      type: this.type(),
      status: this.status(),
      coverImageUrl: this.uploadedCoverUrl() || undefined,
      genres: this.selectedGenres(),
    };
    const work = await firstValueFrom(this.uploadService.createWork(workPayload));
    this.createdWork.set(work);
    return work;
  }

  private async publishDirect(work: Work, uploadedPages: PageUploadItem[], chapterNumber: string): Promise<void> {
    this.uploadStatusText.set('Publishing chapter directly to catalog…');
    const pagesPayload: PageAsset[] = uploadedPages.map((p) => ({
      pageNumber: p.pageNumber,
      storageKey: p.storageKey ?? '',
      cdnUrl: p.cdnUrl ?? '',
      width: p.width,
      height: p.height,
    }));
    const chapter = await firstValueFrom(
      this.uploadService.directPublishChapter(work.id, {
        chapterNumber,
        title: this.chapterTitle().trim() || undefined,
        pages: pagesPayload,
      })
    );
    this.createdChapterId.set(chapter.id);
  }

  private async createScanlationTask(work: Work, uploadedPages: PageUploadItem[], chapterNumber: string): Promise<void> {
    this.uploadStatusText.set('Attaching RAW package to scanlation workspace…');
    // Errors propagate: a failed lookup must be reported, not treated as "no project".
    const projects = await firstValueFrom(this.uploadService.getProjectsForWork(work.id));
    const projectId = projects[0]?.id;
    if (!projectId) {
      throw new UploadFlowError(NO_PROJECT_ERROR);
    }
    this.createdProjectId.set(projectId);
    await firstValueFrom(
      this.uploadService.createScanlationTask(projectId, {
        chapterNumber: Number(chapterNumber),
        assetUrl: uploadedPages[0]?.cdnUrl ?? '',
        pageCount: uploadedPages.length,
      })
    );
  }

  resetStudio(): void {
    this.revokePreviews();
    this.title.set('');
    this.type.set('MANGA');
    this.status.set('ONGOING');
    this.synopsis.set('');
    this.selectedGenres.set(['Action']);
    this.coverFile.set(null);
    this.coverPreviewUrl.set('');
    this.chapterNumber.set('1');
    this.chapterTitle.set('');
    this.publishingMode.set('DIRECT');
    this.pages.set([]);
    this.createdWork.set(null);
    this.createdChapterId.set(null);
    this.createdProjectId.set(null);
    this.uploadedCoverUrl.set(null);
    this.uploadProgress.set(0);
    this.uploadStatusText.set('');
    this.errorMessage.set(null);
    this.currentStep.set('manga');
  }
}
