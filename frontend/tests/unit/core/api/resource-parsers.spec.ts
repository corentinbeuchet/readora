import { TestBed } from '@angular/core/testing';
import { HttpResourceRef } from '@angular/common/http';
import { signal } from '@angular/core';
import { HttpTestingController, TestRequest } from '@angular/common/http/testing';
import { ApiError, parseEnvelope } from '@app/core/api/api-client';
import { CatalogApi } from '@app/core/api/catalog-api';
import { CommentsApi } from '@app/core/api/comments-api';
import { API, fail, ok, provideHttpTesting, resourcesStable } from '../../test-utils';

describe('httpResource envelope parsing', () => {
  let http: HttpTestingController;
  let resource: HttpResourceRef<unknown>;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [...provideHttpTesting()] });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('parseEnvelope returns data, and throws ApiError for success:false or a non-envelope body', () => {
    thenParsingGives(ok([1]), [1]);
    thenParsingThrowsAnApiError(fail('Quota exceeded'));
    thenParsingThrows(fail('Quota exceeded'), 'Quota exceeded');
    thenParsingThrows('<html>proxy error</html>', 'Unexpected response from the server');
  });

  it('a list resource surfaces success:false as an error instead of an empty list', async () => {
    givenIWatchTheCommentsOfChapter('chap-1');

    await whenTheServerAnswers(`${API}/comments/chapter/chap-1`, fail('Comments are disabled'));

    thenTheResourceErrorIsAnApiError();
    thenTheResourceErrorSays('Comments are disabled');
    thenTheResourceHasNoValue();
  });

  it('the paged works resource surfaces success:false as an error instead of an empty page', async () => {
    givenIBrowseTheWorks({ page: 0, size: 20 });

    await whenTheServerAnswers(`${API}/works`, fail('Catalog unavailable'));

    thenTheResourceErrorSays('Catalog unavailable');
  });

  function givenIWatchTheCommentsOfChapter(chapterId: string): void {
    resource = TestBed.runInInjectionContext(() => TestBed.inject(CommentsApi).forChapterResource(signal(chapterId)));
    TestBed.tick();
  }

  function givenIBrowseTheWorks(query: { page: number; size: number }): void {
    resource = TestBed.runInInjectionContext(() => TestBed.inject(CatalogApi).worksResource(signal(query)));
    TestBed.tick();
  }

  async function whenTheServerAnswers(url: string, body: Parameters<TestRequest['flush']>[0]): Promise<void> {
    http.expectOne((r) => r.url === url).flush(body);
    await resourcesStable();
  }

  function thenParsingGives(body: unknown, data: unknown): void {
    expect(parseEnvelope(body)).toEqual(data);
  }

  function thenParsingThrowsAnApiError(body: unknown): void {
    expect(() => parseEnvelope(body)).toThrow(ApiError);
  }

  function thenParsingThrows(body: unknown, message: string): void {
    expect(() => parseEnvelope(body)).toThrow(message);
  }

  function thenTheResourceErrorIsAnApiError(): void {
    expect(resource.error()).toBeInstanceOf(ApiError);
  }

  function thenTheResourceErrorSays(message: string): void {
    expect(resource.error()?.message).toBe(message);
  }

  function thenTheResourceHasNoValue(): void {
    expect(resource.hasValue()).toBe(false);
  }
});
