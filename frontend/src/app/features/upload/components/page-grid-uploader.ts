import { ChangeDetectionStrategy, Component, model, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  PageUploadItem,
  createPreviewUrl,
  extractArchiveImages,
  getImageDimensions,
  isArchiveFile,
  isImageFile,
  sortFilesNaturally,
} from '@app/core/upload/file-utils';

@Component({
  selector: 'app-page-grid-uploader',
  imports: [CommonModule],
  template: `
    <div class="page-uploader-container">
      <div
        class="drop-zone"
        [class.dragging]="isDragging()"
        (dragover)="onDragOver($event)"
        (dragleave)="onDragLeave($event)"
        (drop)="onDrop($event)"
        (click)="fileInput.click()"
        tabindex="0"
        role="button"
        aria-label="Upload chapter pages or archive"
        (keydown.enter)="fileInput.click()"
        (keydown.space)="fileInput.click()"
      >
        <input
          #fileInput
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,image/gif,image/avif,.zip,.cbz"
          class="visually-hidden"
          (change)="onFileInputChange($event)"
        />
        <div class="drop-prompt">
          <span class="upload-icon" aria-hidden="true">📁</span>
          <p class="primary-text">
            <strong>Choose image files</strong> or a <strong>.ZIP / .CBZ</strong> archive
          </p>
          <p class="muted secondary-text">Drag & drop chapter pages (JPEG, PNG, WebP) or click to browse</p>
        </div>
      </div>

      @if (extracting()) {
        <div class="processing-banner" role="status">
          <span class="spinner" aria-hidden="true"></span>
          <span>Extracting archive pages…</span>
        </div>
      }

      @if (pages().length > 0) {
        <div class="pages-header">
          <div class="pages-count">
            <strong>{{ pages().length }}</strong> {{ pages().length === 1 ? 'page' : 'pages' }} loaded
          </div>
          <div class="pages-actions">
            <button type="button" class="btn btn-sm" (click)="sortNaturally()">
              Sort Numerically
            </button>
            <button type="button" class="btn btn-sm btn-danger-outline" (click)="clearAll()">
              Clear All
            </button>
          </div>
        </div>

        <ul class="page-grid" role="list">
          @for (page of pages(); track page.id; let i = $index) {
            <li
              class="page-card"
              draggable="true"
              (dragstart)="onItemDragStart(i, $event)"
              (dragover)="onItemDragOver(i, $event)"
              (drop)="onItemDrop(i, $event)"
            >
              <div class="thumbnail-wrapper">
                <img [src]="page.previewUrl" [alt]="'Page ' + (i + 1)" class="page-thumbnail" loading="lazy" />
                <span class="page-badge">#{{ i + 1 }}</span>
                <div class="page-overlay-actions">
                  <button
                    type="button"
                    class="icon-btn"
                    [disabled]="i === 0"
                    (click)="move(i, i - 1); $event.stopPropagation()"
                    title="Move left"
                    aria-label="Move left"
                  >
                    ◀
                  </button>
                  <button
                    type="button"
                    class="icon-btn"
                    [disabled]="i === pages().length - 1"
                    (click)="move(i, i + 1); $event.stopPropagation()"
                    title="Move right"
                    aria-label="Move right"
                  >
                    ▶
                  </button>
                  <button
                    type="button"
                    class="icon-btn btn-delete"
                    (click)="remove(i); $event.stopPropagation()"
                    title="Delete page"
                    aria-label="Delete page"
                  >
                    ✕
                  </button>
                </div>
              </div>
              <div class="page-meta">
                <span class="page-filename" [title]="page.file.name">{{ page.file.name }}</span>
                @if (page.width && page.height) {
                  <span class="page-dims">{{ page.width }}×{{ page.height }}</span>
                }
              </div>
            </li>
          }
        </ul>
      }
    </div>
  `,
  styles: `
    .page-uploader-container {
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }

    .drop-zone {
      border: 2px dashed var(--border-color, #3a3f4b);
      border-radius: 0.75rem;
      padding: 2.5rem 1.5rem;
      text-align: center;
      background: var(--surface-1, #1e222b);
      cursor: pointer;
      transition: border-color 0.2s, background-color 0.2s;

      &:hover,
      &.dragging {
        border-color: var(--accent, #3b82f6);
        background: var(--surface-2, #262b36);
      }

      &:focus-visible {
        outline: 2px solid var(--accent, #3b82f6);
        outline-offset: 2px;
      }
    }

    .visually-hidden {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }

    .drop-prompt {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.5rem;

      .upload-icon {
        font-size: 2.5rem;
        margin-bottom: 0.25rem;
      }

      .primary-text {
        font-size: 1.05rem;
        margin: 0;
      }

      .secondary-text {
        font-size: 0.875rem;
        margin: 0;
      }
    }

    .processing-banner {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.75rem;
      padding: 0.75rem;
      background: var(--surface-2, #262b36);
      border-radius: 0.5rem;
      font-size: 0.9rem;
      color: var(--accent, #3b82f6);
    }

    .spinner {
      width: 1rem;
      height: 1rem;
      border: 2px solid currentColor;
      border-right-color: transparent;
      border-radius: 50%;
      animation: spin 0.75s linear infinite;
    }

    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }

    .pages-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 0.75rem;
      padding: 0.5rem 0;
      border-bottom: 1px solid var(--border-color, #3a3f4b);
    }

    .pages-actions {
      display: flex;
      gap: 0.5rem;
    }

    .btn-sm {
      padding: 0.35rem 0.75rem;
      font-size: 0.85rem;
    }

    .btn-danger-outline {
      color: #ef4444;
      border-color: #ef4444;
      background: transparent;

      &:hover {
        background: rgba(239, 68, 68, 0.15);
      }
    }

    .page-grid {
      list-style: none;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
      gap: 1rem;
      padding: 0;
      margin: 0;
    }

    .page-card {
      background: var(--surface-2, #262b36);
      border-radius: 0.5rem;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      border: 1px solid var(--border-color, #3a3f4b);
      transition: transform 0.15s, box-shadow 0.15s;

      &:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);

        .page-overlay-actions {
          opacity: 1;
        }
      }
    }

    .thumbnail-wrapper {
      position: relative;
      aspect-ratio: 5 / 7;
      background: #111;
      overflow: hidden;

      .page-thumbnail {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .page-badge {
        position: absolute;
        top: 0.35rem;
        left: 0.35rem;
        background: rgba(0, 0, 0, 0.75);
        color: #fff;
        padding: 0.15rem 0.4rem;
        font-size: 0.75rem;
        font-weight: 600;
        border-radius: 0.25rem;
        backdrop-filter: blur(2px);
      }

      .page-overlay-actions {
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        background: linear-gradient(to top, rgba(0, 0, 0, 0.85), transparent);
        padding: 0.5rem 0.35rem;
        display: flex;
        justify-content: center;
        gap: 0.35rem;
        opacity: 0;
        transition: opacity 0.2s;
      }

      .icon-btn {
        background: rgba(255, 255, 255, 0.2);
        color: #fff;
        border: none;
        border-radius: 0.25rem;
        width: 1.6rem;
        height: 1.6rem;
        font-size: 0.75rem;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        transition: background-color 0.15s;

        &:hover:not(:disabled) {
          background: var(--accent, #3b82f6);
        }

        &:disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }

        &.btn-delete:hover:not(:disabled) {
          background: #ef4444;
        }
      }
    }

    .page-meta {
      padding: 0.4rem 0.5rem;
      display: flex;
      flex-direction: column;
      gap: 0.15rem;

      .page-filename {
        font-size: 0.75rem;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .page-dims {
        font-size: 0.68rem;
        color: var(--text-muted, #9ca3af);
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PageGridUploader {
  readonly pages = model<PageUploadItem[]>([]);
  protected readonly isDragging = signal(false);
  protected readonly extracting = signal(false);

  private dragSourceIndex: number | null = null;

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);
    if (event.dataTransfer?.files) {
      void this.handleFiles(Array.from(event.dataTransfer.files));
    }
  }

  onFileInputChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      void this.handleFiles(Array.from(input.files));
      input.value = '';
    }
  }

  async handleFiles(incoming: File[]): Promise<void> {
    const imagesToAdd: File[] = [];

    for (const file of incoming) {
      if (isArchiveFile(file)) {
        this.extracting.set(true);
        try {
          const extracted = await extractArchiveImages(file);
          imagesToAdd.push(...extracted);
        } catch (e) {
          console.error('Failed to unpack archive', e);
        } finally {
          this.extracting.set(false);
        }
      } else if (isImageFile(file)) {
        imagesToAdd.push(file);
      }
    }

    if (imagesToAdd.length === 0) return;

    const newItems: PageUploadItem[] = [];
    let startPage = this.pages().length + 1;

    for (const file of imagesToAdd) {
      const previewUrl = createPreviewUrl(file);
      const dims = await getImageDimensions(file);
      newItems.push({
        id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2),
        file,
        previewUrl,
        pageNumber: startPage++,
        width: dims.width,
        height: dims.height,
        status: 'pending',
        progress: 0,
      });
    }

    this.pages.update((current) => [...current, ...newItems]);
  }

  sortNaturally(): void {
    const current = [...this.pages()];
    current.sort((a, b) => a.file.name.localeCompare(b.file.name, undefined, { numeric: true, sensitivity: 'base' }));
    current.forEach((item, idx) => {
      item.pageNumber = idx + 1;
    });
    this.pages.set(current);
  }

  move(from: number, to: number): void {
    if (to < 0 || to >= this.pages().length) return;
    const items = [...this.pages()];
    const [moved] = items.splice(from, 1);
    items.splice(to, 0, moved);
    items.forEach((item, idx) => {
      item.pageNumber = idx + 1;
    });
    this.pages.set(items);
  }

  remove(index: number): void {
    const items = [...this.pages()];
    items.splice(index, 1);
    items.forEach((item, idx) => {
      item.pageNumber = idx + 1;
    });
    this.pages.set(items);
  }

  clearAll(): void {
    this.pages.set([]);
  }

  onItemDragStart(index: number, event: DragEvent): void {
    this.dragSourceIndex = index;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
    }
  }

  onItemDragOver(index: number, event: DragEvent): void {
    event.preventDefault();
  }

  onItemDrop(index: number, event: DragEvent): void {
    event.preventDefault();
    if (this.dragSourceIndex !== null && this.dragSourceIndex !== index) {
      this.move(this.dragSourceIndex, index);
    }
    this.dragSourceIndex = null;
  }
}
