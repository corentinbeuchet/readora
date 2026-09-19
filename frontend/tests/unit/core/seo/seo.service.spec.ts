import { TestBed } from '@angular/core/testing';
import { DOCUMENT, LOCALE_ID } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { DEFAULT_DESCRIPTION, SeoService } from '@app/core/seo/seo.service';

type PageMeta = Parameters<SeoService['update']>[0];

describe('SeoService', () => {
  let seo: SeoService;
  let doc: Document;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    seo = TestBed.inject(SeoService);
    doc = TestBed.inject(DOCUMENT);
    doc.head.querySelectorAll('link[rel="canonical"], link[rel="alternate"]').forEach((link) => link.remove());
  });

  it('sets title, description, Open Graph, Twitter and canonical for a public page', () => {
    whenIDescribeThePage({ title: 'Berserk (MANGA)', description: 'Dark fantasy', path: '/works/abc', image: 'https://cdn.readora.com/berserk.webp', type: 'article' });

    thenTheTitleIs('Berserk (MANGA) · Readora');
    thenTheMetaTagIs('description', 'Dark fantasy');
    thenTheMetaTagIs('robots', 'index, follow');
    thenTheMetaTagIs('og:title', 'Berserk (MANGA) · Readora');
    thenTheMetaTagIs('og:type', 'article');
    thenTheMetaTagPointsToTheSite('og:url', '/works/abc');
    thenTheMetaTagIs('og:image', 'https://cdn.readora.com/berserk.webp');
    thenTheMetaTagIs('twitter:card', 'summary_large_image');
    thenTheCanonicalLinkPointsToTheSite('/works/abc');
  });

  it('links the same page in every site language', () => {
    whenIDescribeThePage({ title: 'Berserk', path: '/works/abc' });

    thenTheAlternatesAre({ en: '/works/abc', fr: '/fr/works/abc', 'x-default': '/works/abc' });
  });

  it('uses defaults, keeps the site name once and updates tags in place', () => {
    whenIDescribeThePage({ title: 'Catalog', path: '/works' });

    thenTheMetaTagIs('description', DEFAULT_DESCRIPTION);
    thenThereIsOneMetaTag('description');

    whenIDescribeThePage({ title: 'Readora — read manga, manhwa & comics', path: '/' });

    thenTheTitleIs('Readora — read manga, manhwa & comics');
    thenThereIsOneMetaTag('og:title');
  });

  it('marks private pages noindex and drops the canonical link', () => {
    givenIAmOnAPublicPage({ title: 'Catalog', path: '/works' });

    whenIMarkThePagePrivate('My profile');

    thenTheTitleIs('My profile · Readora');
    thenTheMetaTagIs('robots', 'noindex, nofollow');
    thenThereIsNoCanonicalLink();
    thenTheAlternatesAre({});

    whenIShowNotFound();

    thenTheTitleIs('Page not found · Readora');
    thenTheMetaTagIs('robots', 'noindex, nofollow');
  });

  function givenIAmOnAPublicPage(page: PageMeta): void {
    seo.update(page);
  }

  function whenIDescribeThePage(page: PageMeta): void {
    seo.update(page);
  }

  function whenIMarkThePagePrivate(title: string): void {
    seo.private_(title);
  }

  function whenIShowNotFound(): void {
    seo.notFound();
  }

  function thenTheTitleIs(title: string): void {
    expect(TestBed.inject(Title).getTitle()).toBe(title);
  }

  function thenTheMetaTagIs(name: string, content: string): void {
    expect(metaTag(name)?.getAttribute('content') ?? null).toBe(content);
  }

  function thenTheMetaTagPointsToTheSite(name: string, path: string): void {
    thenTheMetaTagIs(name, `${seo.siteUrl}${path}`);
  }

  function thenThereIsOneMetaTag(name: string): void {
    expect(doc.head.querySelectorAll(metaSelector(name)).length).toBe(1);
  }

  function thenTheCanonicalLinkPointsToTheSite(path: string): void {
    expect(canonicalLink()?.getAttribute('href')).toBe(`${seo.siteUrl}${path}`);
  }

  function thenTheAlternatesAre(paths: Record<string, string>): void {
    const links = Array.from(doc.head.querySelectorAll<HTMLLinkElement>('link[rel="alternate"][hreflang]'));
    const actual = Object.fromEntries(links.map((link) => [link.hreflang, link.getAttribute('href')]));
    expect(actual).toEqual(Object.fromEntries(Object.entries(paths).map(([lang, path]) => [lang, `${seo.siteUrl}${path}`])));
  }

  function thenThereIsNoCanonicalLink(): void {
    expect(canonicalLink()).toBeNull();
  }

  /** Open Graph tags use `property`, the others `name`. */
  function metaSelector(name: string): string {
    return name.startsWith('og:') ? `meta[property="${name}"]` : `meta[name="${name}"]`;
  }

  function metaTag(name: string): HTMLMetaElement | null {
    return doc.head.querySelector<HTMLMetaElement>(metaSelector(name));
  }

  function canonicalLink(): HTMLLinkElement | null {
    return doc.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  }
});

describe('SeoService in the French build', () => {
  let seo: SeoService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [{ provide: LOCALE_ID, useValue: 'fr' }] });
    seo = TestBed.inject(SeoService);
  });

  afterEach(() => TestBed.inject(DOCUMENT).head.querySelectorAll('link[rel="canonical"], link[rel="alternate"]').forEach((link) => link.remove()));

  it('points the canonical link at the French page', () => {
    whenIDescribeThePage({ title: 'Berserk', path: '/works/abc' });

    thenTheCanonicalLinkIs('/fr/works/abc');
  });

  function whenIDescribeThePage(page: PageMeta): void {
    seo.update(page);
  }

  function thenTheCanonicalLinkIs(path: string): void {
    expect(TestBed.inject(DOCUMENT).head.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(`${seo.siteUrl}${path}`);
  }
});
