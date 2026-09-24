export const FALLBACK_PAGE_IMAGE =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1200" viewBox="0 0 800 1200"><defs><pattern id="d" width="8" height="8" patternUnits="userSpaceOnUse"><circle cx="4" cy="4" r="1.4" fill="%23303035"/></pattern></defs><rect width="800" height="1200" fill="%23212124"/><rect width="800" height="1200" fill="url(%23d)"/><text x="50%" y="50%" fill="%23a3a3ab" font-family="system-ui, sans-serif" font-size="20" text-anchor="middle" dominant-baseline="middle">Page Image Unavailable</text></svg>';

export function onImageError(event: Event, fallback: string): void {
  const target = event.target as HTMLImageElement | null;
  if (target && target.src !== fallback) {
    target.src = fallback;
  }
}
