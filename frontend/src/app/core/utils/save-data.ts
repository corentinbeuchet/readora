/** `navigator.connection` (Network Information API) is not in the DOM typings of every browser. */
interface NavigatorWithConnection {
  connection?: { saveData?: boolean };
}

/**
 * Whether the browser asks sites to save data (the `Save-Data` hint: Chrome's "Lite mode", Android data saver).
 * `false` where the browser doesn't say, and on the server (pass `inject(DOCUMENT)`).
 */
export function browserSavesData(document: Document): boolean {
  const navigator = document.defaultView?.navigator as NavigatorWithConnection | undefined;
  return navigator?.connection?.saveData === true;
}
