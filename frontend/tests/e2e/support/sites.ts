/** Where the e2e suite finds the site: a deployed environment (`PLAYWRIGHT_BASE_URL`) or the local dev servers. */
export const DEPLOYED_URL = process.env['PLAYWRIGHT_BASE_URL'];

/** The French build (US-13): /fr/ when deployed; locally `npm run start:fr` serves it at the root of :4201. */
export const FRENCH_URL = DEPLOYED_URL ? `${DEPLOYED_URL.replace(/\/+$/, '')}/fr/` : 'http://localhost:4201/';
