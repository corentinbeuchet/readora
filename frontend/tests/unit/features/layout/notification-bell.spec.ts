import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { NOTIFICATION_POLL_MS, NotificationBell } from '@app/features/layout/notification-bell';
import { AuthStore } from '@app/core/auth/auth-store';
import { ReaderNotification } from '@app/core/models/readora.models';
import { environment } from '../../../../src/environments/environment';
import { mockUser, signIn } from '../../core/auth/auth-fixtures';

const API = environment.apiUrl;
const NEW_CHAPTER: ReaderNotification = {
  id: 'n-1',
  type: 'NEW_CHAPTER',
  message: 'Solo Leveling: chapter 7 is out',
  link: '/read/c-7',
  createdAt: new Date().toISOString(),
  read: false
};
const REPLY: ReaderNotification = { ...NEW_CHAPTER, id: 'n-2', type: 'COMMENT_REPLY', message: 'aoi replied to your comment', link: '/read/c-5?comment=x-1' };

describe('NotificationBell (US-10)', () => {
  let fixture: ComponentFixture<NotificationBell>;
  let http: HttpTestingController;
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NotificationBell],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()]
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    await signIn(TestBed.inject(AuthStore), http, mockUser({ permissions: ['LIBRARY_USE'] }));
    vi.useFakeTimers();
    fixture = TestBed.createComponent(NotificationBell);
    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(0);
  });

  afterEach(() => {
    http.verify();
    vi.useRealTimers();
  });

  async function answerCount(count: number): Promise<void> {
    http.expectOne(`${API}/notifications/unread-count`).flush({ success: true, data: { count }, error: null });
    await vi.advanceTimersByTimeAsync(0);
    fixture.detectChanges();
  }

  const trigger = (): HTMLButtonElement => fixture.nativeElement.querySelector('.bell-trigger');

  it('shows the unread count and keeps it fresh with a slow poll', async () => {
    await answerCount(3);
    expect(trigger().getAttribute('aria-label')).toBe('Notifications, 3 unread');
    expect(fixture.nativeElement.querySelector('.bell-count').textContent.trim()).toBe('3');

    await vi.advanceTimersByTimeAsync(NOTIFICATION_POLL_MS);
    await answerCount(4);
    expect(fixture.nativeElement.querySelector('.bell-count').textContent.trim()).toBe('4');
  });

  it('lists recent notifications, marks them all read, and follows a link with its query string', async () => {
    await answerCount(2);
    trigger().click();
    http.expectOne(`${API}/notifications`).flush({ success: true, data: [NEW_CHAPTER, REPLY], error: null });
    await vi.advanceTimersByTimeAsync(0);
    fixture.detectChanges();

    expect(trigger().getAttribute('aria-expanded')).toBe('true');
    const items = fixture.nativeElement.querySelectorAll('.bell-list li');
    expect(items).toHaveLength(2);
    expect(items[0].textContent).toContain('Solo Leveling: chapter 7 is out');

    fixture.nativeElement.querySelector('.bell-header button').click();
    http.expectOne(`${API}/notifications/read-all`).flush({ success: true, data: { count: 0 }, error: null });
    await vi.advanceTimersByTimeAsync(0);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.bell-count')).toBeNull();
    expect(fixture.nativeElement.querySelectorAll('.bell-list li.unread')).toHaveLength(0);

    const navigate = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    fixture.nativeElement.querySelectorAll('.bell-list a')[1].click();
    fixture.detectChanges();
    expect(navigate).toHaveBeenCalledWith('/read/c-5?comment=x-1');
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
    http.match(`${API}/notifications/unread-count`).forEach((r) => r.flush({ success: true, data: { count: 0 }, error: null }));
  });

  it('keeps the last count when a refresh fails, and says when the list cannot load', async () => {
    await answerCount(5);
    await vi.advanceTimersByTimeAsync(NOTIFICATION_POLL_MS);
    http.expectOne(`${API}/notifications/unread-count`).flush({ success: false, data: null, error: 'down' }, { status: 503, statusText: 'Down' });
    await vi.advanceTimersByTimeAsync(0);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.bell-count').textContent.trim()).toBe('5');

    trigger().click();
    http.expectOne(`${API}/notifications`).flush({ success: false, data: null, error: 'down' }, { status: 503, statusText: 'Down' });
    await vi.advanceTimersByTimeAsync(0);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.bell-panel [role="alert"]').textContent).toContain('Could not load your notifications.');
  });
});
