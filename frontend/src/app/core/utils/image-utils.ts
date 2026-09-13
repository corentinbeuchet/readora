export const FALLBACK_COVER_IMAGE =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="240" height="336" viewBox="0 0 240 336"><rect width="240" height="336" fill="%231e293b"/><text x="50%" y="46%" fill="%2394a3b8" font-family="system-ui, sans-serif" font-weight="bold" font-size="15" text-anchor="middle" dominant-baseline="middle">Readora</text><text x="50%" y="56%" fill="%2364748b" font-family="system-ui, sans-serif" font-size="12" text-anchor="middle" dominant-baseline="middle">Cover Unavailable</text></svg>';

export const FALLBACK_PAGE_IMAGE =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1200" viewBox="0 0 800 1200"><rect width="800" height="1200" fill="%230f172a"/><text x="50%" y="50%" fill="%2364748b" font-family="system-ui, sans-serif" font-size="20" text-anchor="middle" dominant-baseline="middle">Page Image Unavailable</text></svg>';

export function onImageError(event: Event, fallback = FALLBACK_COVER_IMAGE): void {
  const target = event.target as HTMLImageElement | null;
  if (target && target.src !== fallback) {
    target.src = fallback;
  }
}
