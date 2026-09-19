import { HttpRequest } from '@angular/common/http';
import { isTransferCacheable } from '@app/core/api/transfer-cache';

describe('HTTP transfer cache filter', () => {
  const get = (path: string) => new HttpRequest('GET', `https://api.readora.com/api/v1${path}`);

  it('hands over public catalog reads from the prerendered page', () => {
    for (const path of ['/works?page=0&size=24', '/works/genres', '/works/w-1', '/works/w-1/chapters', '/works/w-1/ratings', '/works/w-1/reviews', '/chapters/c-1']) {
      expect(isTransferCacheable(get(path)), path).toBe(true);
    }
  });

  it('never caches user-specific, random or live data, nor writes', () => {
    for (const path of ['/works/w-1/rating/mine', '/works/random', '/library', '/bookmarks', '/notifications', '/updates', '/reading/works/w-1', '/auth/me']) {
      expect(isTransferCacheable(get(path)), path).toBe(false);
    }
    expect(isTransferCacheable(new HttpRequest('POST', 'https://api.readora.com/api/v1/works', {}))).toBe(false);
  });
});
