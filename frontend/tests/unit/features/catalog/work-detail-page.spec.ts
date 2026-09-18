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

  afterEach(() => http.verify());

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
});
