import { DOCUMENT, Service, inject } from '@angular/core';

/**
 * SSR-safe `localStorage` for small user preferences (never for tokens). On the server, in private modes or
 * when storage is disabled or full, reads return `null` and writes are dropped: callers keep working with defaults.
 */
@Service()
export class BrowserStorage {
  private readonly storage = resolveStorage(inject(DOCUMENT));
  /** `false` on the server or when the browser blocks storage (then every read is `null`). */
  readonly available = this.storage !== null;

  read<T>(key: string): T | null {
    try {
      const raw = this.storage?.getItem(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  }

  write(key: string, value: unknown): void {
    try {
      this.storage?.setItem(key, JSON.stringify(value));
    } catch {
      // Quota exceeded or storage disabled: the preference simply isn't kept.
    }
  }
}

function resolveStorage(document: Document): Storage | null {
  try {
    return document.defaultView?.localStorage ?? null;
  } catch {
    return null; // Accessing localStorage throws when the browser blocks it.
  }
}
