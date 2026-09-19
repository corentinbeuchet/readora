import { Component, DestroyRef, inject, model, signal } from '@angular/core';
import { I18nPluralPipe } from '@angular/common';
import {
  ArchiveError,
  DEFAULT_ARCHIVE_LIMITS,
  PageUploadItem,
  createPreviewUrl,
  extractArchiveImages,
  getImageDimensions,
  isArchiveFile,
  isImageFile,
  mapWithConcurrency,
  naturalCompare,
  revokePreviewUrl,
} from '../services/file-utils';

/** How many images are decoded in parallel to read their dimensions. */
export const IMAGE_DECODE_CONCURRENCY = 4;

/** Returns the items renumbered 1..n, as new objects when the number changes (never mutates). */
function renumber(items: PageUploadItem[]): PageUploadItem[] {
  return items.map((item, idx) => (item.pageNumber === idx + 1 ? item : { ...item, pageNumber: idx + 1 }));
}

function newId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2);
}

/**
 * Chapter page picker (images or ZIP/CBZ).
 *
 * Object URL ownership: this component creates a preview URL per page and revokes it when the page
 * is removed or cleared. Pages still in the `pages` model when it is destroyed belong to the model's
 * owner (the wizard keeps them across steps), which revokes them on reset/destroy.
 */
@Component({
  selector: 'app-page-grid-uploader',
  imports: [I18nPluralPipe],
  templateUrl: './page-grid-uploader.html',
  styleUrl: './page-grid-uploader.scss'
})
export class PageGridUploader {
  readonly pages = model<PageUploadItem[]>([]);
  protected readonly pagesPlural = { '=1': '1 page', other: '# pages' };
  protected readonly isDragging = signal(false);
  protected readonly extracting = signal(false);
  /** Problems with the last dropped/selected files, shown to the user (role="alert"). */
  protected readonly problems = signal<string[]>([]);

  private dragSourceIndex: number | null = null;
  private destroyed = false;

  constructor() {
    inject(DestroyRef).onDestroy(() => (this.destroyed = true));
  }

  protected onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(true);
  }

  protected onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);
    if (event.dataTransfer?.files) {
      void this.handleFiles(Array.from(event.dataTransfer.files));
    }
  }

  protected onFileInputChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      void this.handleFiles(Array.from(input.files));
      input.value = '';
    }
  }

  private async handleFiles(incoming: File[]): Promise<void> {
    const imagesToAdd: File[] = [];
    const problems: string[] = [];
    const limits = DEFAULT_ARCHIVE_LIMITS;

    for (const file of incoming) {
      if (isArchiveFile(file)) {
        this.extracting.set(true);
        try {
          imagesToAdd.push(...(await extractArchiveImages(file, limits)));
        } catch (e) {
          problems.push(e instanceof ArchiveError ? e.message : `"${file.name}" could not be unpacked.`);
        } finally {
          this.extracting.set(false);
        }
      } else if (!isImageFile(file)) {
        problems.push(`"${file.name}" was skipped: only images and .zip/.cbz archives are accepted.`);
      } else if (file.size > limits.maxEntryBytes) {
        problems.push(`"${file.name}" was skipped: pages must be at most ${Math.round(limits.maxEntryBytes / (1024 * 1024))} MB.`);
      } else {
        imagesToAdd.push(file);
      }
    }

    const room = limits.maxImageEntries - this.pages().length;
    if (imagesToAdd.length > room) {
      problems.push(`A chapter can have at most ${limits.maxImageEntries} pages: ${imagesToAdd.length - Math.max(0, room)} pages were not added.`);
      imagesToAdd.splice(Math.max(0, room));
    }
    this.problems.set(problems);

    if (imagesToAdd.length === 0) return;

    // One preview URL per page, reused to read the dimensions (decoded a few at a time, not serially).
    const newItems = await mapWithConcurrency(imagesToAdd, IMAGE_DECODE_CONCURRENCY, async (file): Promise<PageUploadItem> => {
      const previewUrl = createPreviewUrl(file);
      const dims = await getImageDimensions(file, previewUrl);
      return { id: newId(), file, previewUrl, pageNumber: 0, width: dims.width, height: dims.height, status: 'pending', progress: 0 };
    });

    if (this.destroyed) {
      // Nobody will render or own these previews any more.
      newItems.forEach((item) => revokePreviewUrl(item.previewUrl));
      return;
    }
    this.pages.update((current) => renumber([...current, ...newItems]));
  }

  protected sortNaturally(): void {
    this.pages.update((current) => renumber([...current].sort((a, b) => naturalCompare(a.file.name, b.file.name))));
  }

  protected move(from: number, to: number): void {
    if (to < 0 || to >= this.pages().length) return;
    const items = [...this.pages()];
    const [moved] = items.splice(from, 1);
    items.splice(to, 0, moved);
    this.pages.set(renumber(items));
  }

  protected remove(index: number): void {
    const items = [...this.pages()];
    const [removed] = items.splice(index, 1);
    if (removed) {
      revokePreviewUrl(removed.previewUrl);
    }
    this.pages.set(renumber(items));
  }

  /** Optional page description for screen-reader users (US-07). */
  protected describe(index: number, event: Event): void {
    const description = (event.target as HTMLTextAreaElement).value;
    this.pages.update((items) => items.map((item, i) => (i === index ? { ...item, description } : item)));
  }

  protected clearAll(): void {
    this.pages().forEach((item) => revokePreviewUrl(item.previewUrl));
    this.pages.set([]);
    this.problems.set([]);
  }

  protected onItemDragStart(index: number, event: DragEvent): void {
    this.dragSourceIndex = index;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
    }
  }

  protected onItemDragOver(_index: number, event: DragEvent): void {
    event.preventDefault();
  }

  protected onItemDrop(index: number, event: DragEvent): void {
    event.preventDefault();
    if (this.dragSourceIndex !== null && this.dragSourceIndex !== index) {
      this.move(this.dragSourceIndex, index);
    }
    this.dragSourceIndex = null;
  }
}
