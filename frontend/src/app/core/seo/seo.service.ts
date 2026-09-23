import { DOCUMENT, LOCALE_ID, Service, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { SITE_URL } from '@app/core/config/urls';
import { SITE_LOCALES, localizedPath, siteLocale } from '@app/core/i18n/site-locales';

export interface PageMeta {
  /** Page title without the site suffix. */
  title: string;
  description?: string;
  /**
   * App path (e.g. `/works/123`, without the language prefix) or absolute URL, for the canonical link, `og:url` and
   * the `hreflang` alternates of every site language.
   */
  path?: string;
  image?: string;
  type?: 'website' | 'article';
  /** `true` for private / session-dependent pages that must not be indexed. */
  noindex?: boolean;
}

export const SITE_NAME = 'Readora';
export const DEFAULT_DESCRIPTION = $localize`:@@seo.defaultDescription:Read manga, manhwa, manhua and comics published by scanlation teams. Free reading, comments and bookmarks.`;
const DEFAULT_IMAGE = '/og-default.png';
const TITLE_SUFFIX = ` · ${SITE_NAME}`;

/**
 * Centralised `<head>` management for SEO: title, description, Open Graph / Twitter cards,
 * canonical link, `hreflang` alternates and robots directive. Works during prerendering and in the browser.
 */
@Service()
export class SeoService {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly document = inject(DOCUMENT);
  readonly siteUrl = inject(SITE_URL);
  private readonly locale = siteLocale(inject(LOCALE_ID));

  /** Applies the full set of tags for a page. */
  update(page: PageMeta): void {
    const fullTitle = page.title.includes(SITE_NAME) ? page.title : `${page.title}${TITLE_SUFFIX}`;
    const description = page.description ?? DEFAULT_DESCRIPTION;
    const path = page.path ?? this.currentPath();
    const url = this.isAbsolute(path) ? path : this.absolute(localizedPath(this.locale, path));
    const image = this.absolute(page.image ?? DEFAULT_IMAGE);

    this.title.setTitle(fullTitle);
    this.setName('description', description);
    this.setName('robots', page.noindex ? 'noindex, nofollow' : 'index, follow');

    this.setProperty('og:site_name', SITE_NAME);
    this.setProperty('og:type', page.type ?? 'website');
    this.setProperty('og:title', fullTitle);
    this.setProperty('og:description', description);
    this.setProperty('og:url', url);
    this.setProperty('og:image', image);

    this.setName('twitter:card', 'summary_large_image');
    this.setName('twitter:title', fullTitle);
    this.setName('twitter:description', description);
    this.setName('twitter:image', image);

    this.setCanonical(page.noindex ? null : url);
    this.setAlternates(page.noindex || this.isAbsolute(path) ? null : path);
  }

  /** Shortcut for private pages (profile, auth…). */
  private_(title: string): void {
    this.update({ title, noindex: true });
  }

  /** Marks the current page as not found / errored: keep it out of the index. */
  notFound(title = $localize`:@@seo.notFound.title:Page not found`): void {
    this.update({ title, description: $localize`:@@seo.notFound.description:The requested page could not be found.`, noindex: true });
  }

  private setName(name: string, content: string): void {
    this.meta.updateTag({ name, content }, `name='${name}'`);
  }

  private setProperty(property: string, content: string): void {
    this.meta.updateTag({ property, content }, `property='${property}'`);
  }

  private setCanonical(href: string | null): void {
    const head = this.document.head;
    let link = head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!href) {
      link?.remove();
      return;
    }
    if (!link) {
      link = this.document.createElement('link');
      link.setAttribute('rel', 'canonical');
      head.appendChild(link);
    }
    link.setAttribute('href', href);
  }

  /** The same page in every site language, plus `x-default` (the source language) for everyone else. */
  private setAlternates(path: string | null): void {
    const head = this.document.head;
    head.querySelectorAll('link[rel="alternate"][hreflang]').forEach((link) => link.remove());
    if (path === null) {
      return;
    }
    const alternates = [...SITE_LOCALES.map((locale) => ({ hreflang: locale.code, locale })), { hreflang: 'x-default', locale: SITE_LOCALES[0] }];
    for (const { hreflang, locale } of alternates) {
      const link = this.document.createElement('link');
      link.setAttribute('rel', 'alternate');
      link.setAttribute('hreflang', hreflang);
      link.setAttribute('href', this.absolute(localizedPath(locale, path)));
      head.appendChild(link);
    }
  }

  /** The app path of the current page, without this build's language prefix. */
  private currentPath(): string {
    const pathname = this.document.defaultView?.location.pathname ?? '/';
    const prefix = this.locale.prefix;
    if (prefix && (pathname === prefix || pathname.startsWith(`${prefix}/`))) {
      return pathname.slice(prefix.length) || '/';
    }
    return pathname;
  }

  private isAbsolute(pathOrUrl: string): boolean {
    return /^https?:\/\//i.test(pathOrUrl);
  }

  private absolute(pathOrUrl: string): string {
    if (this.isAbsolute(pathOrUrl)) {
      return pathOrUrl;
    }
    return `${this.siteUrl}${pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`}`;
  }
}
