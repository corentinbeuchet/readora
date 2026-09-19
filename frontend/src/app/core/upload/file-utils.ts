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
  /** Optional text for screen readers, typed in the upload studio (US-07). */
  description?: string;
  /** Data-saver copy made by the server at upload (US-07). */
  liteCdnUrl?: string;
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

/** Limits applied before/while unpacking an archive (zip-bomb and memory guards). */
export interface ArchiveLimits {
  /** Size of the .zip/.cbz file itself. */
  maxArchiveBytes: number;
  /** Image entries kept (the backend accepts at most 1000 pages per chapter). */
  maxImageEntries: number;
  /** All entries in the central directory, images or not. */
  maxTotalEntries: number;
  /** One inflated image (the storage API rejects files above 50 MB). */
  maxEntryBytes: number;
  /** All inflated images together. */
  maxTotalUncompressedBytes: number;
}

const MB = 1024 * 1024;

export const DEFAULT_ARCHIVE_LIMITS: ArchiveLimits = {
  maxArchiveBytes: 500 * MB,
  maxImageEntries: 1000,
  maxTotalEntries: 2000,
  maxEntryBytes: 50 * MB,
  maxTotalUncompressedBytes: 750 * MB,
};

/** An archive that cannot be (safely) unpacked; `message` is written for the user. */
export class ArchiveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ArchiveError';
  }
}

function formatMb(bytes: number): string {
  return `${Math.round(bytes / MB)} MB`;
}

/** Size recorded in the central directory (JSZip keeps it on the private `_data`). May lie. */
function declaredSize(entry: JSZip.JSZipObject): number {
  const data = (entry as unknown as { _data?: { uncompressedSize?: number } })._data;
  return typeof data?.uncompressedSize === 'number' ? data.uncompressedSize : 0;
}

/** Inflates one entry, aborting as soon as it exceeds `maxBytes` (declared sizes can lie). */
function readEntryBounded(entry: JSZip.JSZipObject, maxBytes: number): Promise<Uint8Array<ArrayBuffer>> {
  type Stream = JSZip.JSZipStreamHelper<Uint8Array>;
  const stream = (entry as unknown as { internalStream(type: 'uint8array'): Stream }).internalStream('uint8array');
  return new Promise((resolve, reject) => {
    const chunks: Uint8Array[] = [];
    let total = 0;
    let failed = false;
    stream
      .on('data', (chunk) => {
        if (failed) return;
        total += chunk.length;
        if (total > maxBytes) {
          failed = true;
          stream.pause();
          reject(new ArchiveError(`"${entry.name}" is larger than ${formatMb(maxBytes)} once unpacked.`));
          return;
        }
        chunks.push(chunk);
      })
      .on('error', (err) => {
        if (!failed) {
          failed = true;
          reject(new ArchiveError(`"${entry.name}" could not be unpacked (${err.message}).`));
        }
      })
      .on('end', () => {
        if (failed) return;
        const out = new Uint8Array(total);
        let offset = 0;
        for (const chunk of chunks) {
          out.set(chunk, offset);
          offset += chunk.length;
        }
        resolve(out);
      })
      .resume();
  });
}

/**
 * Extracts the image files of a .zip / .cbz archive, in natural filename order.
 *
 * Bounded: the archive size, the number of entries and the declared uncompressed sizes are checked
 * before inflating anything, and the actual inflated bytes are counted while unpacking, so a zip
 * bomb is rejected instead of exhausting memory. Throws `ArchiveError` with a user-facing message.
 */
export async function extractArchiveImages(archive: File, limits: ArchiveLimits = DEFAULT_ARCHIVE_LIMITS): Promise<File[]> {
  if (archive.size > limits.maxArchiveBytes) {
    throw new ArchiveError(`"${archive.name}" is larger than ${formatMb(limits.maxArchiveBytes)}. Split the chapter into smaller archives.`);
  }

  let loadedZip: JSZip;
  try {
    loadedZip = await new JSZip().loadAsync(archive);
  } catch {
    throw new ArchiveError(`"${archive.name}" is not a valid ZIP/CBZ archive.`);
  }

  const imageEntries: { name: string; zipEntry: JSZip.JSZipObject }[] = [];
  let totalEntries = 0;
  loadedZip.forEach((relativePath, zipEntry) => {
    totalEntries++;
    if (zipEntry.dir) return;
    if (relativePath.includes('__MACOSX') || relativePath.startsWith('.') || relativePath.includes('/.')) return;
    if (isImageFilename(relativePath)) {
      imageEntries.push({ name: relativePath, zipEntry });
    }
  });

  if (totalEntries > limits.maxTotalEntries || imageEntries.length > limits.maxImageEntries) {
    throw new ArchiveError(
      `"${archive.name}" has too many files (at most ${limits.maxImageEntries} pages per chapter).`
    );
  }
  if (imageEntries.length === 0) {
    throw new ArchiveError(`"${archive.name}" does not contain any JPEG, PNG, WebP, GIF or AVIF image.`);
  }

  let declaredTotal = 0;
  for (const { zipEntry } of imageEntries) {
    const size = declaredSize(zipEntry);
    if (size > limits.maxEntryBytes) {
      throw new ArchiveError(`"${zipEntry.name}" is larger than ${formatMb(limits.maxEntryBytes)} once unpacked.`);
    }
    declaredTotal += size;
  }
  if (declaredTotal > limits.maxTotalUncompressedBytes) {
    throw new ArchiveError(`"${archive.name}" is larger than ${formatMb(limits.maxTotalUncompressedBytes)} once unpacked.`);
  }

  imageEntries.sort((a, b) => naturalCompare(a.name, b.name));

  const extractedFiles: File[] = [];
  let inflatedTotal = 0;
  for (const entry of imageEntries) {
    const remaining = limits.maxTotalUncompressedBytes - inflatedTotal;
    const bytes = await readEntryBounded(entry.zipEntry, Math.min(limits.maxEntryBytes, remaining)).catch((err: unknown) => {
      if (err instanceof ArchiveError && remaining < limits.maxEntryBytes) {
        throw new ArchiveError(`"${archive.name}" is larger than ${formatMb(limits.maxTotalUncompressedBytes)} once unpacked.`);
      }
      throw err;
    });
    inflatedTotal += bytes.length;
    const cleanName = entry.name.split('/').pop() || entry.name;
    extractedFiles.push(new File([bytes], cleanName, { type: getMimeTypeFromFilename(cleanName) }));
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
