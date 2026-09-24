import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController, TestRequest } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { ACCOUNT_SEARCH_DEBOUNCE_MS, AdminPage } from '@app/features/admin/admin-page/admin-page';
import { AuthStore } from '@app/core/auth/auth-store';
import { AdminAccount } from '@app/core/models/identity';
import { mockUser, signIn } from '../../../core/auth/auth-fixtures';
import { API, ok, provideHttpTesting, settleUnderFakeTimers } from '../../../test-utils';

const KENJI: AdminAccount = {
  id: 'u-kenji',
  username: 'kenji',
  email: 'kenji@readora.test',
  displayName: 'Kenji',
  roles: ['READER'],
  standing: 'ACTIVE',
  suspendedUntil: null,
  createdAt: '2026-09-01T10:00:00Z'
};
const ME: AdminAccount = { ...KENJI, id: 'u-ada', username: 'ada', email: 'ada@readora.test', displayName: 'Ada', roles: ['ADMIN'] };

describe('AdminPage (US-16)', () => {
  let fixture: ComponentFixture<AdminPage>;
  let http: HttpTestingController;
  let request: TestRequest;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminPage],
      providers: [provideRouter([]), ...provideHttpTesting()]
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    await signIn(TestBed.inject(AuthStore), http, mockUser({ id: 'u-ada', username: 'ada', roles: ['ADMIN'] }));
    vi.useFakeTimers();
    fixture = TestBed.createComponent(AdminPage);
    await settleUnderFakeTimers(fixture);
  });

  afterEach(() => {
    http.verify();
    vi.useRealTimers();
  });

  it('asks for more before searching', async () => {
    await whenITypeAndPause('k');

    thenNothingWasSearched();
    thenICanSee('Type the start of a username or an email.');
  });

  it('finds accounts by the start of a username or an email, with their role', async () => {
    await whenITypeAndPause('ken', { found: [KENJI] });

    thenTheAccountShows('kenji', 'kenji@readora.test');
    thenTheAccountShows('kenji', 'Reader');
  });

  it('changes the role of an account and says so', async () => {
    await whenITypeAndPause('ken', { found: [KENJI] });

    await whenIChooseTheRole('kenji', 'MODERATOR');
    await whenTheServerAnswers({ ...KENJI, roles: ['MODERATOR'] });

    thenTheRequestWas('PUT', '/admin/accounts/u-kenji/role', { role: 'MODERATOR' });
    thenTheAccountShows('kenji', 'Moderator');
    thenTheStatusSays('kenji is now Moderator.');
  });

  it('suspends an account for 7 days, then offers to let it back in', async () => {
    await whenITypeAndPause('ken', { found: [KENJI] });

    await whenIPress('Suspend kenji for 7 days');
    await whenTheServerAnswers({ ...KENJI, standing: 'SUSPENDED', suspendedUntil: '2026-10-01T10:00:00Z' });

    thenTheRequestWas('POST', '/admin/accounts/u-kenji/suspend', { days: 7 });
    thenTheAccountShows('kenji', 'Suspended until');
    thenICanPress('Let kenji back in');
  });

  it('offers no action on my own account', async () => {
    await whenITypeAndPause('ada', { found: [ME] });

    thenTheAccountShows('ada', 'This is your account');
    thenThereIsNoButtonFor('ada');
  });

  async function whenITypeAndPause(text: string, answer?: { found: AdminAccount[] }): Promise<void> {
    const input = page().querySelector<HTMLInputElement>('#account-search')!;
    input.value = text;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(ACCOUNT_SEARCH_DEBOUNCE_MS);
    await settleUnderFakeTimers(fixture);
    if (answer) {
      http.expectOne((r) => r.url === `${API}/admin/accounts` && r.params.get('q') === text).flush(ok(answer.found));
      await settleUnderFakeTimers(fixture);
    }
  }

  async function whenIChooseTheRole(username: string, role: string): Promise<void> {
    const select = accountRow(username).querySelector<HTMLSelectElement>('select')!;
    select.value = role;
    select.dispatchEvent(new Event('change'));
    await whenIPress(`Change role of ${username}`);
  }

  async function whenIPress(name: string): Promise<void> {
    button(name)!.click();
    await settleUnderFakeTimers(fixture);
  }

  async function whenTheServerAnswers(updated: AdminAccount): Promise<void> {
    request = http.expectOne((r) => r.url.startsWith(`${API}/admin/accounts/`));
    request.flush(ok(updated));
    await settleUnderFakeTimers(fixture);
  }

  function thenNothingWasSearched(): void {
    http.expectNone((r) => r.url === `${API}/admin/accounts`);
  }

  function thenTheRequestWas(method: string, path: string, body: object): void {
    expect(request.request.method).toBe(method);
    expect(request.request.url).toBe(`${API}${path}`);
    expect(request.request.body).toEqual(body);
  }

  function thenTheAccountShows(username: string, text: string): void {
    expect(accountRow(username).textContent).toContain(text);
  }

  function thenTheStatusSays(text: string): void {
    expect(page().querySelector('p[role="status"]')!.textContent!.trim()).toBe(text);
  }

  function thenICanPress(name: string): void {
    expect(button(name)).toBeDefined();
  }

  function thenThereIsNoButtonFor(username: string): void {
    expect(accountRow(username).querySelectorAll('button').length).toBe(0);
  }

  function thenICanSee(text: string): void {
    expect(page().textContent).toContain(text);
  }

  function accountRow(username: string): HTMLElement {
    return Array.from(page().querySelectorAll<HTMLElement>('.account')).find((row) => row.textContent!.includes(`@${username}`))!;
  }

  function button(name: string): HTMLButtonElement | undefined {
    return Array.from(page().querySelectorAll<HTMLButtonElement>('button')).find((b) => b.textContent!.replace(/\s+/g, ' ').trim() === name);
  }

  function page(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }
});
