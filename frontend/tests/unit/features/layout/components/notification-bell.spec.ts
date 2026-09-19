import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { NOTIFICATION_POLL_MS, NotificationBell } from '@app/features/layout/components/notification-bell';
import { AuthStore } from '@app/core/auth/auth-store';
import { ReaderNotification } from '@app/core/models/readora.models';
import { mockUser, signIn } from '../../../core/auth/auth-fixtures';
import { ANY_URL, API, fail, ok, provideHttpTesting } from '../../../test-utils';

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
      providers: [provideRouter(ANY_URL), ...provideHttpTesting()]
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
    http.expectOne(`${API}/notifications/unread-count`).flush(ok({ count }));
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
    http.expectOne(`${API}/notifications`).flush(ok([NEW_CHAPTER, REPLY]));
    await vi.advanceTimersByTimeAsync(0);
    fixture.detectChanges();

    expect(trigger().getAttribute('aria-expanded')).toBe('true');
    const items = fixture.nativeElement.querySelectorAll('.bell-list li');
    expect(items).toHaveLength(2);
    expect(items[0].textContent).toContain('Solo Leveling: chapter 7 is out');

    fixture.nativeElement.querySelector('.bell-header button').click();
    http.expectOne(`${API}/notifications/read-all`).flush(ok({ count: 0 }));
    await vi.advanceTimersByTimeAsync(0);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.bell-count')).toBeNull();
    expect(fixture.nativeElement.querySelectorAll('.bell-list li.unread')).toHaveLength(0);

    fixture.nativeElement.querySelectorAll('.bell-list a')[1].click();
    await vi.advanceTimersByTimeAsync(0);
    fixture.detectChanges();
    expect(router.url).toBe('/read/c-5?comment=x-1');
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
    http.match(`${API}/notifications/unread-count`).forEach((r) => r.flush(ok({ count: 0 })));
  });

  it('keeps the last count when a refresh fails, and says when the list cannot load', async () => {
    await answerCount(5);
    await vi.advanceTimersByTimeAsync(NOTIFICATION_POLL_MS);
    http.expectOne(`${API}/notifications/unread-count`).flush(fail('down'), { status: 503, statusText: 'Down' });
    await vi.advanceTimersByTimeAsync(0);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.bell-count').textContent.trim()).toBe('5');

    trigger().click();
    http.expectOne(`${API}/notifications`).flush(fail('down'), { status: 503, statusText: 'Down' });
    await vi.advanceTimersByTimeAsync(0);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.bell-panel [role="alert"]').textContent).toContain('Could not load your notifications.');
  });

  it('closes on Escape and gives focus back to the bell', async () => {
    await answerCount(0);
    trigger().click();
    http.expectOne(`${API}/notifications`).flush(ok([NEW_CHAPTER]));
    await vi.advanceTimersByTimeAsync(0);
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.bell-list a') as HTMLElement).focus();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(trigger());
  });

  it('does not poll while the tab is hidden', async () => {
    await answerCount(1);
    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    await vi.advanceTimersByTimeAsync(NOTIFICATION_POLL_MS);
    http.expectNone(`${API}/notifications/unread-count`);
    visibility.mockReturnValue('visible');
    await vi.advanceTimersByTimeAsync(NOTIFICATION_POLL_MS);
    await answerCount(2);
    expect(fixture.nativeElement.querySelector('.bell-count').textContent.trim()).toBe('2');
  });

  it("never shows the previous account's notifications after switching user", async () => {
    await answerCount(4);
    trigger().click();
    http.expectOne(`${API}/notifications`).flush(ok([NEW_CHAPTER]));
    await vi.advanceTimersByTimeAsync(0);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.bell-list li')).toHaveLength(1);

    await signIn(TestBed.inject(AuthStore), http, mockUser({ id: 'user-2', permissions: ['LIBRARY_USE'] }));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.bell-count')).toBeNull();
    expect(fixture.nativeElement.querySelectorAll('.bell-list li')).toHaveLength(0);
  });
});
