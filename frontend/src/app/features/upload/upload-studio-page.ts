import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { SeoService } from '@app/core/seo/seo.service';
import { UploadService } from '@app/core/upload/upload.service';
import {
  CreateWorkPayload,
  PageAsset,
  Work,
  WorkStatus,
  WorkType,
} from '@app/core/models/readora.models';
import { PageUploadItem, createPreviewUrl, isImageFile } from '@app/core/upload/file-utils';
import { PageGridUploader } from './components/page-grid-uploader';

export type UploadStep = 'manga' | 'chapter' | 'pages' | 'review' | 'success';
export type PublishingMode = 'DIRECT' | 'SCANLATION';

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
  private readonly router = inject(Router);

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

  readonly availableGenres = GENRE_PRESETS;

  // Validation computed signals
  readonly isMangaStepValid = computed(() => {
    return this.title().trim().length > 0 && this.title().trim().length <= 255;
  });

  readonly isChapterStepValid = computed(() => {
    return this.chapterNumber().trim().length > 0;
  });

  readonly isPagesStepValid = computed(() => {
    return this.pages().length > 0;
  });

  constructor() {
    this.seo.update({
      title: 'Upload Studio — Readora',
      description: 'Create manga series, upload chapter pages, and publish directly or via scanlation pipeline.',
      path: '/upload',
    });
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
      this.coverFile.set(file);
      this.coverPreviewUrl.set(createPreviewUrl(file));
      this.errorMessage.set(null);
    } else {
      this.errorMessage.set('Cover file must be an image (JPEG, PNG, WebP)');
    }
  }

  removeCover(): void {
    this.coverFile.set(null);
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
      this.errorMessage.set('Please provide a valid chapter number');
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

  // Final Publish Workflow
  async submitUpload(): Promise<void> {
    if (!this.isMangaStepValid() || !this.isChapterStepValid() || !this.isPagesStepValid()) {
      this.errorMessage.set('Please complete all required fields before publishing.');
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set(null);
    this.uploadProgress.set(5);
    this.uploadStatusText.set('Uploading cover image…');

    try {
      let coverImageUrl = '';
      const cover = this.coverFile();
      if (cover) {
        const coverRes = await new Promise<{ storageKey: string; cdnUrl: string }>((resolve, reject) => {
          this.uploadService.uploadCover(cover).subscribe({
            next: resolve,
            error: reject,
          });
        });
        coverImageUrl = coverRes.cdnUrl;
      }

      this.uploadProgress.set(20);
      this.uploadStatusText.set('Creating series in catalog…');

      const workPayload: CreateWorkPayload = {
        title: this.title().trim(),
        synopsis: this.synopsis().trim(),
        type: this.type(),
        status: this.status(),
        coverImageUrl: coverImageUrl || undefined,
        genres: this.selectedGenres(),
      };

      const work = await new Promise<Work>((resolve, reject) => {
        this.uploadService.createWork(workPayload).subscribe({
          next: resolve,
          error: reject,
        });
      });

      this.createdWork.set(work);
      this.uploadProgress.set(40);
      this.uploadStatusText.set(`Uploading ${this.pages().length} chapter pages…`);

      // Upload chapter pages batch
      const pagesToUpload = this.pages();
      const uploadedPages = await new Promise<PageUploadItem[]>((resolve, reject) => {
        this.uploadService
          .uploadPagesBatch(pagesToUpload, `scans/${work.id}/c${this.chapterNumber()}`, 3, (completed, total) => {
            const pageProgress = 40 + Math.floor((completed / total) * 45);
            this.uploadProgress.set(pageProgress);
            this.uploadStatusText.set(`Uploaded ${completed}/${total} pages…`);
          })
          .subscribe({
            next: resolve,
            error: reject,
          });
      });

      this.uploadProgress.set(90);

      if (this.publishingMode() === 'DIRECT') {
        this.uploadStatusText.set('Publishing chapter directly to catalog…');

        const pagesPayload: PageAsset[] = uploadedPages.map((p) => ({
          pageNumber: p.pageNumber,
          storageKey: p.storageKey || '',
          cdnUrl: p.cdnUrl || '',
          width: p.width,
          height: p.height,
        }));

        const chapter = await new Promise<{ id: string }>((resolve, reject) => {
          this.uploadService
            .directPublishChapter(work.id, {
              chapterNumber: this.chapterNumber().trim(),
              title: this.chapterTitle().trim() || undefined,
              pages: pagesPayload,
            })
            .subscribe({
              next: resolve,
              error: reject,
            });
        });

        this.createdChapterId.set(chapter.id);
      } else {
        this.uploadStatusText.set('Attaching RAW package to scanlation workspace…');

        // Look up workspace project created for this work
        const projects = await new Promise<{ id: string }[]>((resolve) => {
          this.uploadService.getProjectsForWork(work.id).subscribe({
            next: resolve,
            error: () => resolve([]),
          });
        });

        const projectId = projects.length > 0 ? projects[0].id : '';
        this.createdProjectId.set(projectId);

        if (projectId) {
          const firstAssetUrl = uploadedPages[0]?.cdnUrl || '';
          await new Promise((resolve, reject) => {
            this.uploadService
              .createScanlationTask(projectId, {
                chapterNumber: parseFloat(this.chapterNumber()) || 1,
                assetUrl: firstAssetUrl,
                pageCount: uploadedPages.length,
              })
              .subscribe({
                next: resolve,
                error: reject,
              });
          });
        }
      }

      this.uploadProgress.set(100);
      this.uploadStatusText.set('Upload completed successfully!');
      this.currentStep.set('success');
    } catch (err: unknown) {
      console.error('Upload failed:', err);
      const msg = err instanceof Error ? err.message : 'An unexpected error occurred during upload.';
      this.errorMessage.set(msg);
    } finally {
      this.isSubmitting.set(false);
    }
  }

  resetStudio(): void {
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
    this.errorMessage.set(null);
    this.currentStep.set('manga');
  }
}
