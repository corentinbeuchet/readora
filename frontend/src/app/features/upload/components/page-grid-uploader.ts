import { ChangeDetectionStrategy, Component, model, signal } from '@angular/core';
import {
  PageUploadItem,
  createPreviewUrl,
  extractArchiveImages,
  getImageDimensions,
  isArchiveFile,
  isImageFile,
} from '@app/core/upload/file-utils';

@Component({
  selector: 'app-page-grid-uploader',
  templateUrl: './page-grid-uploader.html',
  styleUrl: './page-grid-uploader.scss',
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
