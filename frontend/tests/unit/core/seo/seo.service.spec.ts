import { TestBed } from '@angular/core/testing';
import { DOCUMENT } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { DEFAULT_DESCRIPTION, SeoService } from '@app/core/seo/seo.service';

describe('SeoService', () => {
  let seo: SeoService;
  let doc: Document;

  const meta = (selector: string): string | null => doc.head.querySelector<HTMLMetaElement>(`meta[${selector}]`)?.getAttribute('content') ?? null;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    seo = TestBed.inject(SeoService);
    doc = TestBed.inject(DOCUMENT);
    doc.head.querySelector('link[rel="canonical"]')?.remove();
  });

  it('sets title, description, Open Graph, Twitter and canonical for a public page', () => {
    seo.update({ title: 'Berserk (MANGA)', description: 'Dark fantasy', path: '/works/abc', image: 'https://cdn.readora.com/berserk.webp', type: 'article' });

    expect(TestBed.inject(Title).getTitle()).toBe('Berserk (MANGA) · Readora');
    expect(meta('name="description"')).toBe('Dark fantasy');
    expect(meta('name="robots"')).toBe('index, follow');
    expect(meta('property="og:title"')).toBe('Berserk (MANGA) · Readora');
    expect(meta('property="og:type"')).toBe('article');
    expect(meta('property="og:url"')).toBe(`${seo.siteUrl}/works/abc`);
    expect(meta('property="og:image"')).toBe('https://cdn.readora.com/berserk.webp');
    expect(meta('name="twitter:card"')).toBe('summary_large_image');
    expect(doc.head.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(`${seo.siteUrl}/works/abc`);
  });

  it('uses defaults, keeps the site name once and updates tags in place', () => {
    seo.update({ title: 'Catalog', path: '/works' });
    expect(meta('name="description"')).toBe(DEFAULT_DESCRIPTION);
    expect(doc.head.querySelectorAll('meta[name="description"]').length).toBe(1);

    seo.update({ title: 'Readora — read manga, manhwa & comics', path: '/' });
    expect(TestBed.inject(Title).getTitle()).toBe('Readora — read manga, manhwa & comics');
    expect(doc.head.querySelectorAll('meta[property="og:title"]').length).toBe(1);
  });

  it('marks private pages noindex and drops the canonical link', () => {
    seo.update({ title: 'Catalog', path: '/works' });
    seo.private_('My profile');

    expect(TestBed.inject(Title).getTitle()).toBe('My profile · Readora');
    expect(meta('name="robots"')).toBe('noindex, nofollow');
    expect(doc.head.querySelector('link[rel="canonical"]')).toBeNull();

    seo.notFound();
    expect(TestBed.inject(Title).getTitle()).toBe('Page not found · Readora');
    expect(meta('name="robots"')).toBe('noindex, nofollow');
  });
});
