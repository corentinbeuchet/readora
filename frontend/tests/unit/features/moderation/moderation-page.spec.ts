import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { ModerationPage } from '@app/features/moderation/moderation-page';
import { ModerationItem } from '@app/core/models/readora.models';
import { environment } from '../../../../src/environments/environment';
import { settle } from '../../test-utils';

const API = environment.apiUrl;
const ITEM: ModerationItem = {
  reportId: 'r-1',
  reason: 'UNMARKED_SPOILER',
  reportedAt: '2026-09-10T10:00:00Z',
  commentId: 'c-1',
  chapterId: 'ch-5',
  authorUsername: 'aoi',
  content: 'He dies in the end',
  spoiler: false
};

describe('ModerationPage (US-11)', () => {
  let fixture: ComponentFixture<ModerationPage>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ModerationPage],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()]
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ModerationPage);
    await settle(fixture);
  });

  afterEach(() => http.verify());

  const buttons = (): HTMLButtonElement[] => Array.from(fixture.nativeElement.querySelectorAll('.queue-actions button'));

  it('shows each reported comment with its reason and a link to it in context', async () => {
    http.expectOne(`${API}/moderation/reports`).flush({ success: true, data: [ITEM], error: null });
    await settle(fixture);

    const item: HTMLElement = fixture.nativeElement.querySelector('.queue-item');
    expect(item.textContent).toContain('Unmarked spoiler');
    expect(item.textContent).toContain('He dies in the end');
    expect(item.querySelector('a')!.getAttribute('href')).toBe('/read/ch-5?comment=c-1');
  });

  it('hides the comment, then reloads the queue', async () => {
    http.expectOne(`${API}/moderation/reports`).flush({ success: true, data: [ITEM], error: null });
    await settle(fixture);

    buttons()[0].click();
    http.expectOne(`${API}/moderation/reports/r-1/hide`).flush({ success: true, data: { status: 'HIDDEN' }, error: null });
    await settle(fixture);
    http.expectOne(`${API}/moderation/reports`).flush({ success: true, data: [], error: null });
    await settle(fixture);

    expect(fixture.nativeElement.textContent).toContain('No open reports.');
  });

  it('dismisses a report and shows errors', async () => {
    http.expectOne(`${API}/moderation/reports`).flush({ success: true, data: [ITEM], error: null });
    await settle(fixture);

    buttons()[1].click();
    http.expectOne(`${API}/moderation/reports/r-1/dismiss`).flush({ success: false, data: null, error: 'Open comment report not found' }, { status: 404, statusText: 'Not Found' });
    await settle(fixture);

    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain('Open comment report not found');
  });
});
