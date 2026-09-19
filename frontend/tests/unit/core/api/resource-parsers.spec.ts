import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { HttpTestingController } from '@angular/common/http/testing';
import { ApiError, parseEnvelope } from '@app/core/api/api-client';
import { CatalogApi } from '@app/core/api/catalog-api';
import { CommentsApi } from '@app/core/api/comments-api';
import { API, fail, ok, provideHttpTesting, resourcesStable } from '../../test-utils';

describe('httpResource envelope parsing', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [...provideHttpTesting()] });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('parseEnvelope returns data, and throws ApiError for success:false or a non-envelope body', () => {
    expect(parseEnvelope<number[]>(ok([1]))).toEqual([1]);
    expect(() => parseEnvelope(fail('Quota exceeded'))).toThrow(ApiError);
    expect(() => parseEnvelope(fail('Quota exceeded'))).toThrow('Quota exceeded');
    expect(() => parseEnvelope('<html>proxy error</html>')).toThrow('Unexpected response from the server');
  });

  it('a list resource surfaces success:false as an error instead of an empty list', async () => {
    const comments = TestBed.runInInjectionContext(() => TestBed.inject(CommentsApi).forChapterResource(signal('chap-1')));
    TestBed.tick();
    http.expectOne(`${API}/comments/chapter/chap-1`).flush(fail('Comments are disabled'));
    await resourcesStable();

    expect(comments.error()).toBeInstanceOf(ApiError);
    expect(comments.error()?.message).toBe('Comments are disabled');
    expect(comments.hasValue()).toBe(false);
  });

  it('the paged works resource surfaces success:false as an error instead of an empty page', async () => {
    const works = TestBed.runInInjectionContext(() => TestBed.inject(CatalogApi).worksResource(signal({ page: 0, size: 20 })));
    TestBed.tick();
    http.expectOne((r) => r.url === `${API}/works`).flush(fail('Catalog unavailable'));
    await resourcesStable();

    expect(works.error()?.message).toBe('Catalog unavailable');
  });
});
