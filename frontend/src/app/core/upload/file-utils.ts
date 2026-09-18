import JSZip from 'jszip';

export interface PageUploadItem {
  id: string;
  file: File;
  previewUrl: string;
  pageNumber: number;
  width?: number;
  height?: number;
  status: 'pending' | 'uploading' | 'done' | 'error';
  progress: number;
  storageKey?: string;
  cdnUrl?: string;
  error?: string;
}

export const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif'];
export const ARCHIVE_EXTENSIONS = ['.zip', '.cbz'];

/**
 * Natural alphanumeric comparator for sorting page filenames (e.g. 1.jpg, 2.jpg, 10.jpg).
 */
export function naturalCompare(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

export function isImageFilename(filename: string): boolean {
  const lower = filename.toLowerCase();
  return IMAGE_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export function isArchiveFilename(filename: string): boolean {
  const lower = filename.toLowerCase();
  return ARCHIVE_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/') || isImageFilename(file.name);
}

export function isArchiveFile(file: File): boolean {
  return (
    file.type === 'application/zip' ||
    file.type === 'application/x-zip-compressed' ||
    file.type === 'application/x-cbz' ||
    isArchiveFilename(file.name)
  );
}

/**
 * Sorts an array of Files naturally by filename.
 */
export function sortFilesNaturally(files: File[]): File[] {
  return [...files].sort((a, b) => naturalCompare(a.name, b.name));
}

/**
 * Extracts all image files from a .zip or .cbz archive in-memory.
 */
export async function extractArchiveImages(archive: File): Promise<File[]> {
  const zip = new JSZip();
  const loadedZip = await zip.loadAsync(archive);
  const imageEntries: { name: string; zipEntry: JSZip.JSZipObject }[] = [];

  loadedZip.forEach((relativePath, zipEntry) => {
    if (zipEntry.dir) return;
    if (relativePath.includes('__MACOSX') || relativePath.startsWith('.') || relativePath.includes('/.')) return;
    if (isImageFilename(relativePath)) {
      imageEntries.push({ name: relativePath, zipEntry });
    }
  });

  // Sort entries naturally
  imageEntries.sort((a, b) => naturalCompare(a.name, b.name));

  const extractedFiles: File[] = [];
  for (const entry of imageEntries) {
    const blob = await entry.zipEntry.async('blob');
    const cleanName = entry.name.split('/').pop() || entry.name;
    const mimeType = getMimeTypeFromFilename(cleanName);
    const file = new File([blob], cleanName, { type: mimeType });
    extractedFiles.push(file);
  }

  return extractedFiles;
}

export function getMimeTypeFromFilename(filename: string): string {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.avif')) return 'image/avif';
  return 'image/jpeg';
}

/**
 * Generates an object preview URL for a File. Every URL returned here must be released with
 * `revokePreviewUrl` when the preview is removed, replaced, reset or destroyed.
 */
export function createPreviewUrl(file: File): string {
  if (typeof URL !== 'undefined' && URL.createObjectURL) {
    return URL.createObjectURL(file);
  }
  return '';
}

/** Releases a URL created by `createPreviewUrl` (no-op for empty / non-blob URLs). */
export function revokePreviewUrl(url: string | null | undefined): void {
  if (url && url.startsWith('blob:') && typeof URL !== 'undefined' && URL.revokeObjectURL) {
    URL.revokeObjectURL(url);
  }
}

/** Maps `items` through `fn` with at most `limit` calls in flight; results keep the input order. */
export async function mapWithConcurrency<T, R>(items: readonly T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const worker = async (): Promise<void> => {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index], index);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker));
  return results;
}

/**
 * Reads image dimensions asynchronously. Pass an existing preview URL to avoid creating (and
 * decoding from) a second object URL; a URL created here is revoked here. Resolves 0x0 on failure.
 */
export function getImageDimensions(file: File, previewUrl?: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    if (typeof Image === 'undefined') {
      resolve({ width: 0, height: 0 });
      return;
    }
    const ownUrl = !previewUrl;
    const url = previewUrl || createPreviewUrl(file);
    if (!url) {
      resolve({ width: 0, height: 0 });
      return;
    }
    const img = new Image();
    const done = (width: number, height: number): void => {
      if (ownUrl) {
        revokePreviewUrl(url);
      }
      resolve({ width, height });
    };
    img.onload = () => done(img.naturalWidth || img.width, img.naturalHeight || img.height);
    img.onerror = () => done(0, 0);
    img.src = url;
  });
}
