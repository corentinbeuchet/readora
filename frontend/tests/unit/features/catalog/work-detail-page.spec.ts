import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { WorkDetailPage } from '@app/features/catalog/work-detail-page';
import { AuthStore } from '@app/core/auth/auth-store';
import { Work } from '@app/core/models/readora.models';
import { environment } from '../../../../src/environments/environment';
import { mockUser, signIn } from '../../core/auth/auth-fixtures';
import { settle } from '../../test-utils';

const API = environment.apiUrl;
const WORK: Work = {
  id: 'w-1',
  title: 'Solo Leveling',
  synopsis: 'Hunters',
  type: 'MANHWA',
  status: 'ONGOING',
  coverImageUrl: 'https://cdn.readora.com/covers/w-1.webp',
  genres: ['Action']
};

describe('WorkDetailPage', () => {
  let fixture: ComponentFixture<WorkDetailPage>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WorkDetailPage],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()]
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    // The ratings section (its own spec) loads with the page.
    http.match((r) => r.url.endsWith('/lists/mine')).forEach((r) => r.flush({ success: true, data: [], error: null }));
    http.match((r) => /\/works\/[^/]+\/(ratings|reviews|rating\/mine)$/.test(r.url)).forEach((r) =>
      r.flush({ success: true, data: r.request.url.endsWith('ratings') ? { average: 0, count: 0 } : [], error: null })
    );
    http.verify();
  });

  it('"Continue reading" restores the saved page via ?page=N', async () => {
    await signIn(TestBed.inject(AuthStore), http, mockUser({ permissions: ['BOOKMARK_READ', 'BOOKMARK_WRITE'] }));
    fixture = TestBed.createComponent(WorkDetailPage);
    fixture.componentRef.setInput('workId', WORK.id);
    await settle(fixture);

    http.expectOne(`${API}/works/${WORK.id}`).flush({ success: true, data: WORK, error: null });
    http.expectOne(`${API}/works/${WORK.id}/chapters`).flush({ success: true, data: [], error: null });
    http.expectOne(`${API}/bookmarks`).flush({
      success: true,
      data: [{ workId: WORK.id, lastReadChapterId: 'chap-7', lastReadPageIndex: 5, status: 'READING', updatedAt: '' }],
      error: null
    });
    await settle(fixture);

    const link: HTMLAnchorElement = fixture.nativeElement.querySelector('.work-actions a');
    expect(link.textContent).toContain('Continue reading (page 5)');
    expect(link.getAttribute('href')).toBe('/read/chap-7?page=5');
  });

  it('shows an error (not "no chapters") when the chapter list answers success:false', async () => {
    fixture = TestBed.createComponent(WorkDetailPage);
    fixture.componentRef.setInput('workId', WORK.id);
    await settle(fixture);

    http.expectOne(`${API}/works/${WORK.id}`).flush({ success: true, data: WORK, error: null });
    http.expectOne(`${API}/works/${WORK.id}/chapters`).flush({ success: false, data: null, error: 'Chapters unavailable' });
    await settle(fixture);

    const alert: HTMLElement = fixture.nativeElement.querySelector('.chapters [role="alert"]');
    expect(alert.textContent).toContain('The chapter list could not be loaded.');
    expect(fixture.nativeElement.textContent).not.toContain('No chapters have been published yet.');
  });

  describe('library and read markers (LIBRARY_USE)', () => {
    const CHAPTERS = ['1', '2', '3'].map((n) => ({
      id: `c-${n}`,
      workId: WORK.id,
      chapterNumber: n,
      title: `Chapter ${n}`,
      status: 'PUBLISHED' as const,
      pageCount: 10
    }));

    async function openAsFreeReader(inLibrary: boolean): Promise<void> {
      await signIn(TestBed.inject(AuthStore), http, mockUser({ permissions: ['LIBRARY_USE'] }));
      fixture = TestBed.createComponent(WorkDetailPage);
      fixture.componentRef.setInput('workId', WORK.id);
      await settle(fixture);
      http.expectOne(`${API}/works/${WORK.id}`).flush({ success: true, data: WORK, error: null });
      http.expectOne(`${API}/works/${WORK.id}/chapters`).flush({ success: true, data: CHAPTERS, error: null });
      http.expectOne((r) => r.url === `${API}/library`).flush({
        success: true,
        data: inLibrary ? [{ work: WORK, status: 'READING', addedAt: '', updatedAt: '', newChapters: 0 }] : [],
        error: null
      });
      http.expectOne(`${API}/reading/works/${WORK.id}`).flush({
        success: true,
        data: { workId: WORK.id, finishedChapterIds: ['c-1'], nextChapterId: 'c-2' },
        error: null
      });
      await settle(fixture);
    }

    it('dims finished chapters, highlights the next one and continues from it', async () => {
      await openAsFreeReader(true);

      const links: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('.chapter-link'));
      expect(links[0].classList).toContain('chapter-read');
      expect(links[0].textContent).toContain('✓ Read');
      expect(links[1].classList).toContain('chapter-next');
      expect(links[1].textContent).toContain('Next up');
      expect(links[2].classList).not.toContain('chapter-read');
      const primary: HTMLAnchorElement = fixture.nativeElement.querySelector('.work-actions a.btn-primary');
      expect(primary.textContent).toContain('Continue with chapter 2');
      expect(primary.getAttribute('href')).toBe('/read/c-2');
      expect(fixture.nativeElement.querySelector('.library-status select').value).toBe('READING');
    });

    it('adds the series to the library, then removes it', async () => {
      await openAsFreeReader(false);

      const add: HTMLButtonElement = Array.from<HTMLButtonElement>(fixture.nativeElement.querySelectorAll('.work-actions button')).find((b) =>
        b.textContent?.includes('Add to library')
      )!;
      add.click();
      const save = http.expectOne(`${API}/library/${WORK.id}`);
      expect(save.request.method).toBe('PUT');
      expect(save.request.body).toEqual({});
      save.flush({ success: true, data: { workId: WORK.id, status: 'READING', addedAt: '', updatedAt: '' }, error: null });
      await settle(fixture);
      expect(fixture.nativeElement.querySelector('.library-status select').value).toBe('READING');

      fixture.nativeElement.querySelector('.work-actions .btn-link').click();
      http.expectOne(`${API}/library/${WORK.id}`).flush(null, { status: 204, statusText: 'No Content' });
      await settle(fixture);
      expect(fixture.nativeElement.textContent).toContain('+ Add to library');
    });
  });
});
