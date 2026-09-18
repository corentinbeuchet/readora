import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApiError, parseEnvelope } from '@app/core/api/api-client';
import { CatalogApi } from '@app/core/api/catalog-api';
import { CommentsApi } from '@app/core/api/comments-api';
import { environment } from '../../../../src/environments/environment';

const API = environment.apiUrl;

describe('httpResource envelope parsing', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  async function settle(): Promise<void> {
    TestBed.tick();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    TestBed.tick();
  }

  it('parseEnvelope returns data, and throws ApiError for success:false or a non-envelope body', () => {
    expect(parseEnvelope<number[]>({ success: true, data: [1], error: null })).toEqual([1]);
    expect(() => parseEnvelope({ success: false, data: null, error: 'Quota exceeded' })).toThrow(ApiError);
    expect(() => parseEnvelope({ success: false, data: null, error: 'Quota exceeded' })).toThrow('Quota exceeded');
    expect(() => parseEnvelope('<html>proxy error</html>')).toThrow('Unexpected response from the server');
  });

  it('a list resource surfaces success:false as an error instead of an empty list', async () => {
    const comments = TestBed.runInInjectionContext(() => TestBed.inject(CommentsApi).forChapterResource(signal('chap-1')));
    await settle();
    http.expectOne(`${API}/comments/chapter/chap-1`).flush({ success: false, data: null, error: 'Comments are disabled' });
    await settle();

    expect(comments.error()).toBeInstanceOf(ApiError);
    expect(comments.error()?.message).toBe('Comments are disabled');
    expect(comments.hasValue()).toBe(false);
  });

  it('the paged works resource surfaces success:false as an error instead of an empty page', async () => {
    const works = TestBed.runInInjectionContext(() => TestBed.inject(CatalogApi).worksResource(signal(0), signal(20)));
    await settle();
    http.expectOne((r) => r.url === `${API}/works`).flush({ success: false, data: null, error: 'Catalog unavailable' });
    await settle();

    expect(works.error()?.message).toBe('Catalog unavailable');
  });
});
