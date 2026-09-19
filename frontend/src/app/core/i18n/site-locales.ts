/** A language the site is built in (one build per language, see `angular.json` `i18n`; keep both lists in sync). */
export interface SiteLocale {
  /** `LOCALE_ID` of the build and `hreflang` value. */
  code: string;
  /** The language's own name, shown untranslated in the switcher ("Français" on the English site too). */
  label: string;
  /** URL prefix of the build (`subPath`): `''` for the source language at the site root. */
  prefix: string;
}

export const SITE_LOCALES: readonly SiteLocale[] = [
  { code: 'en', label: 'English', prefix: '' },
  { code: 'fr', label: 'Français', prefix: '/fr' }
];

/** The site language of a build (`LOCALE_ID` may carry a region, e.g. `en-US`); the source language otherwise. */
export function siteLocale(localeId: string): SiteLocale {
  const language = localeId.toLowerCase().split('-')[0];
  return SITE_LOCALES.find((locale) => locale.code === language) ?? SITE_LOCALES[0];
}

/** `path` (an app path such as `/works/1?tab=x`, without any language prefix) in `locale`'s build. */
export function localizedPath(locale: SiteLocale, path: string): string {
  return `${locale.prefix}${path.startsWith('/') ? path : `/${path}`}`;
}
