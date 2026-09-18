import { DOCUMENT, Service, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { environment } from '../../../environments/environment';

export interface PageMeta {
  /** Page title without the site suffix. */
  title: string;
  description?: string;
  /** Path (e.g. `/works/123`) or absolute URL used for the canonical link and `og:url`. */
  path?: string;
  image?: string;
  type?: 'website' | 'article';
  /** `true` for private / session-dependent pages that must not be indexed. */
  noindex?: boolean;
}

export const SITE_NAME = 'Readora';
export const DEFAULT_DESCRIPTION = 'Read manga, manhwa, manhua and comics published by scanlation teams. Free reading, comments, and Premium bookmarks.';
const DEFAULT_IMAGE = '/og-default.png';
const TITLE_SUFFIX = ` · ${SITE_NAME}`;

/**
 * Centralised `<head>` management for SEO: title, description, Open Graph / Twitter cards,
 * canonical link and robots directive. Works during prerendering and in the browser.
 */
@Service()
export class SeoService {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly document = inject(DOCUMENT);
  readonly siteUrl = environment.siteUrl.replace(/\/+$/, '');

  /** Applies the full set of tags for a page. */
  update(page: PageMeta): void {
    const fullTitle = page.title.includes(SITE_NAME) ? page.title : `${page.title}${TITLE_SUFFIX}`;
    const description = page.description ?? DEFAULT_DESCRIPTION;
    const url = this.absolute(page.path ?? this.currentPath());
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
  }

  /** Shortcut for private pages (profile, auth, checkout…). */
  private_(title: string): void {
    this.update({ title, noindex: true });
  }

  /** Marks the current page as not found / errored: keep it out of the index. */
  notFound(title = 'Page not found'): void {
    this.update({ title, description: 'The requested page could not be found.', noindex: true });
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

  private currentPath(): string {
    const location = this.document.defaultView?.location;
    return location ? location.pathname : '/';
  }

  private absolute(pathOrUrl: string): string {
    if (/^https?:\/\//i.test(pathOrUrl)) {
      return pathOrUrl;
    }
    return `${this.siteUrl}${pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`}`;
  }
}
