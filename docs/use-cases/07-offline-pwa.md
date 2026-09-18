# Module 7: Offline PWA & Performance

Inspired by **comix.to**, Readora provides offline reading resilience through browser IndexedDB caching, client-side CBZ/ZIP archive generation, and a Progressive Web App (PWA) offline shell.

---

## UC-35: Offline Chapter Downloader & Local Cache (IndexedDB & CBZ)

### Overview
Allows readers to download entire chapters for offline reading (e.g. while commuting or on airplanes). Downloaded chapters can be read directly in the offline reader via IndexedDB or exported as standalone standard `.cbz` comic book archives.

### Actor
- Reader

### Storage Strategy
- **IndexedDB (`idb-keyval` / Dexie.js)**: Stores image blobs keyed by `chapterId` and `pageIndex`.
- **Manifest Store**: Stores chapter metadata, work synopsis, and page count.
- **Client CBZ Packing (`jszip`)**: Compresses downloaded image blobs into a `.cbz` archive with `ComicInfo.xml` metadata for third-party e-readers.

### Primary Flow (In-App Offline Cache)
1. In the chapter list or reader, user clicks the **Download (⬇)** icon next to Chapter 12 (or clicks *"Download Next 5 Chapters"*).
2. The download manager begins background fetching of all page assets for Chapter 12.
3. As images are downloaded, they are stored in the browser's IndexedDB store under `offline_chapters`.
4. A progress ring displays `[45% ... 100%]`.
5. When offline, opening `/read/:workSlug/12` detects network disconnection and transparently loads page blobs directly from IndexedDB with 0ms latency.

### Primary Flow (Export as CBZ)
1. User clicks **"Download as .CBZ"**.
2. The client fetches and bundles the chapter images into a zip container, injecting standard `ComicInfo.xml` with work title, author, chapter number, and series metadata.
3. The browser prompts to save `Solo_Leveling_Ch012.cbz`.

---

## UC-36: Progressive Web App (PWA) Offline Shell

### Overview
Provides an app-like installation on iOS, Android, macOS, and Windows. A custom Service Worker caches the application shell, fonts, and reader core scripts, ensuring the UI boots instantly even with zero internet connectivity.

### Actor
- Reader

### Primary Flow
1. User visits Readora in Chrome / Safari / Edge.
2. An **"Install Readora App"** prompt appears in the browser navigation bar.
3. Clicking **Install** adds Readora to the device home screen / application launcher with standalone display mode.
4. When launched without an internet connection:
   - The Service Worker intercepts requests and serves cached static bundles (`/index.html`, `/main.js`, icons, fonts).
   - An offline status bar appears: *"Offline Mode - Showing 14 cached chapters"*.
   - Reader can navigate directly to the **Downloaded Chapters** shelf and read without interruption.
