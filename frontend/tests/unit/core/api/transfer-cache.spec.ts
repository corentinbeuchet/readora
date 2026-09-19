import { HttpRequest } from '@angular/common/http';
import { isTransferCacheable } from '@app/core/api/transfer-cache';

describe('HTTP transfer cache filter', () => {
  it('hands over public catalog reads from the prerendered page', () => {
    thenTheseReadsAreCached(['/works?page=0&size=24', '/works/genres', '/works/w-1', '/works/w-1/chapters', '/works/w-1/ratings', '/works/w-1/reviews', '/chapters/c-1']);
  });

  it('never caches user-specific, random or live data, nor writes', () => {
    thenTheseReadsAreNotCached(['/works/w-1/rating/mine', '/works/random', '/library', '/bookmarks', '/notifications', '/updates', '/reading/works/w-1', '/auth/me']);
    thenAWriteIsNotCached('/works');
  });

  function thenTheseReadsAreCached(paths: string[]): void {
    for (const path of paths) {
      expect(isTransferCacheable(new HttpRequest('GET', apiUrl(path))), path).toBe(true);
    }
  }

  function thenTheseReadsAreNotCached(paths: string[]): void {
    for (const path of paths) {
      expect(isTransferCacheable(new HttpRequest('GET', apiUrl(path))), path).toBe(false);
    }
  }

  function thenAWriteIsNotCached(path: string): void {
    expect(isTransferCacheable(new HttpRequest('POST', apiUrl(path), {}))).toBe(false);
  }

  function apiUrl(path: string): string {
    return `https://api.readora.com/api/v1${path}`;
  }
});
