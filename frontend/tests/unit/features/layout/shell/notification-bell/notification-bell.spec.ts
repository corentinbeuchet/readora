import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { NOTIFICATION_POLL_MS, NotificationBell } from '@app/features/layout/shell/notification-bell/notification-bell';
import { AuthStore } from '@app/core/auth/auth-store';
import { ReaderNotification } from '@app/core/models/readora.models';
import { mockUser, signIn } from '../../../../core/auth/auth-fixtures';
import { ANY_URL, API, FIXED_NOW, fail, ok, provideHttpTesting } from '../../../../test-utils';

const NEW_CHAPTER: ReaderNotification = {
  id: 'n-1',
  type: 'NEW_CHAPTER',
  message: 'Solo Leveling: chapter 7 is out',
  link: '/read/c-7',
  createdAt: new Date(FIXED_NOW.getTime() - 5 * 60_000).toISOString(),
  read: false
};
const REPLY: ReaderNotification = { ...NEW_CHAPTER, id: 'n-2', type: 'COMMENT_REPLY', message: 'aoi replied to your comment', link: '/read/c-5?comment=x-1' };

describe('NotificationBell (US-10)', () => {
  let fixture: ComponentFixture<NotificationBell>;
  let http: HttpTestingController;
  let router: Router;
  let visibility: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NotificationBell],
      providers: [provideRouter(ANY_URL), ...provideHttpTesting()]
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
  });

  afterEach(() => {
    http.verify();
    vi.useRealTimers();
  });

  it('shows the unread count and keeps it fresh with a slow poll', async () => {
    await givenIHaveUnreadNotifications(3);

    thenTheBellIsLabelled('Notifications, 3 unread');
    thenTheBadgeShows(3);

    await whenThePollAsksAgainAndTheCountIs(4);

    thenTheBadgeShows(4);
  });

  it('lists recent notifications, marks them all read, and follows a link with its query string', async () => {
    await givenIHaveUnreadNotifications(2);

    await whenIOpenTheBell([NEW_CHAPTER, REPLY]);

    thenTheBellIsExpanded(true);
    thenTheListHasNotifications(2);
    thenNotificationSays(1, 'Solo Leveling: chapter 7 is out');

    await whenIMarkThemAllRead();

    thenThereIsNoBadge();
    thenNoNotificationIsUnread();

    await whenIFollowNotification(2);

    thenIAmOn('/read/c-5?comment=x-1');
    thenTheBellIsExpanded(false);
  });

  it('keeps the last count when a refresh fails, and says when the list cannot load', async () => {
    await givenIHaveUnreadNotifications(5);

    await whenThePollAsksAgainAndFails();

    thenTheBadgeShows(5);

    await whenIOpenTheBellButTheListFails();

    thenThePanelAlertSays('Could not load your notifications.');
  });

  it('closes on Escape and gives focus back to the bell', async () => {
    await givenIHaveUnreadNotifications(0);
    await givenTheBellIsOpenWith([NEW_CHAPTER]);
    givenFocusIsOnTheFirstNotification();

    whenIPressEscape();

    thenTheBellIsExpanded(false);
    thenFocusIsOnTheBell();
  });

  it('does not poll while the tab is hidden', async () => {
    await givenIHaveUnreadNotifications(1);

    await whenTheTabStaysHiddenForAPollPeriod();

    thenTheCountWasNotAskedFor();

    await whenTheTabIsVisibleAgainAndTheCountIs(2);

    thenTheBadgeShows(2);
  });

  it("never shows the previous account's notifications after switching user", async () => {
    await givenIHaveUnreadNotifications(4);
    await givenTheBellIsOpenWith([NEW_CHAPTER]);
    thenTheListHasNotifications(1);

    await whenAnotherAccountSignsIn('user-2');

    thenThereIsNoBadge();
    thenTheListHasNotifications(0);
  });

  /** A signed-in reader; the first unread-count request is answered with `count`. */
  async function givenIHaveUnreadNotifications(count: number): Promise<void> {
    await signIn(TestBed.inject(AuthStore), http, mockUser({ permissions: ['LIBRARY_USE'] }));
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
    fixture = TestBed.createComponent(NotificationBell);
    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(0);
    await answerTheCount(count);
  }

  async function givenTheBellIsOpenWith(notifications: ReaderNotification[]): Promise<void> {
    await openTheBell(notifications);
  }

  function givenFocusIsOnTheFirstNotification(): void {
    (fixture.nativeElement.querySelector('.bell-list a') as HTMLElement).focus();
  }

  async function whenThePollAsksAgainAndTheCountIs(count: number): Promise<void> {
    await vi.advanceTimersByTimeAsync(NOTIFICATION_POLL_MS);
    await answerTheCount(count);
  }

  async function whenThePollAsksAgainAndFails(): Promise<void> {
    await vi.advanceTimersByTimeAsync(NOTIFICATION_POLL_MS);
    http.expectOne(`${API}/notifications/unread-count`).flush(fail('down'), { status: 503, statusText: 'Down' });
    await render();
  }

  async function whenIOpenTheBell(notifications: ReaderNotification[]): Promise<void> {
    await openTheBell(notifications);
  }

  async function whenIOpenTheBellButTheListFails(): Promise<void> {
    trigger().click();
    http.expectOne(`${API}/notifications`).flush(fail('down'), { status: 503, statusText: 'Down' });
    await render();
  }

  async function whenIMarkThemAllRead(): Promise<void> {
    fixture.nativeElement.querySelector('.bell-header button').click();
    http.expectOne(`${API}/notifications/read-all`).flush(ok({ count: 0 }));
    await render();
  }

  /** Navigating may refresh the count; those refreshes are answered with 0. */
  async function whenIFollowNotification(position: number): Promise<void> {
    fixture.nativeElement.querySelectorAll('.bell-list a')[position - 1].click();
    await render();
    http.match(`${API}/notifications/unread-count`).forEach((r) => r.flush(ok({ count: 0 })));
  }

  function whenIPressEscape(): void {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
  }

  async function whenTheTabStaysHiddenForAPollPeriod(): Promise<void> {
    visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    await vi.advanceTimersByTimeAsync(NOTIFICATION_POLL_MS);
  }

  async function whenTheTabIsVisibleAgainAndTheCountIs(count: number): Promise<void> {
    visibility.mockReturnValue('visible');
    await vi.advanceTimersByTimeAsync(NOTIFICATION_POLL_MS);
    await answerTheCount(count);
  }

  async function whenAnotherAccountSignsIn(userId: string): Promise<void> {
    await signIn(TestBed.inject(AuthStore), http, mockUser({ id: userId, permissions: ['LIBRARY_USE'] }));
    fixture.detectChanges();
  }

  function thenTheBellIsLabelled(label: string): void {
    expect(trigger().getAttribute('aria-label')).toBe(label);
  }

  function thenTheBadgeShows(count: number): void {
    expect(fixture.nativeElement.querySelector('.bell-count').textContent.trim()).toBe(String(count));
  }

  function thenThereIsNoBadge(): void {
    expect(fixture.nativeElement.querySelector('.bell-count')).toBeNull();
  }

  function thenTheBellIsExpanded(expanded: boolean): void {
    expect(trigger().getAttribute('aria-expanded')).toBe(String(expanded));
  }

  function thenTheListHasNotifications(count: number): void {
    expect(fixture.nativeElement.querySelectorAll('.bell-list li')).toHaveLength(count);
  }

  function thenNotificationSays(position: number, message: string): void {
    expect(fixture.nativeElement.querySelectorAll('.bell-list li')[position - 1].textContent).toContain(message);
  }

  function thenNoNotificationIsUnread(): void {
    expect(fixture.nativeElement.querySelectorAll('.bell-list li.unread')).toHaveLength(0);
  }

  function thenIAmOn(url: string): void {
    expect(router.url).toBe(url);
  }

  function thenThePanelAlertSays(message: string): void {
    expect(fixture.nativeElement.querySelector('.bell-panel [role="alert"]').textContent).toContain(message);
  }

  function thenFocusIsOnTheBell(): void {
    expect(document.activeElement).toBe(trigger());
  }

  function thenTheCountWasNotAskedFor(): void {
    http.expectNone(`${API}/notifications/unread-count`);
  }

  async function answerTheCount(count: number): Promise<void> {
    http.expectOne(`${API}/notifications/unread-count`).flush(ok({ count }));
    await render();
  }

  async function openTheBell(notifications: ReaderNotification[]): Promise<void> {
    trigger().click();
    http.expectOne(`${API}/notifications`).flush(ok(notifications));
    await render();
  }

  async function render(): Promise<void> {
    await vi.advanceTimersByTimeAsync(0);
    fixture.detectChanges();
  }

  function trigger(): HTMLButtonElement {
    return fixture.nativeElement.querySelector('.bell-trigger');
  }
});
