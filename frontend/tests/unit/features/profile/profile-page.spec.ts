import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController, TestRequest } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { ProfilePage } from '@app/features/profile/profile-page';
import { AuthStore } from '@app/core/auth/auth-store';
import { UserProfile } from '@app/core/models/readora.models';
import { mockUser } from '../../core/auth/auth-fixtures';
import { API, ok, provideHttpTesting } from '../../test-utils';

type Profile = Partial<Pick<UserProfile, 'displayName' | 'bio'>>;

describe('ProfilePage (Angular Aria Tabs + Signal Forms)', () => {
  let fixture: ComponentFixture<ProfilePage>;
  let http: HttpTestingController;
  let store: AuthStore;
  let lastRequest: TestRequest;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProfilePage],
      providers: [provideRouter([]), ...provideHttpTesting()]
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    store = TestBed.inject(AuthStore);
  });

  afterEach(() => http.verify());

  it('renders the header, three tabs and the pre-filled profile form on the Overview tab', async () => {
    await givenIAmOnMyProfile({ displayName: 'Jane Reader', bio: 'I read a lot' });

    thenTheHeaderShows('Jane Reader');
    thenTheTabsAre(['Overview', 'Bookmarks', 'Subscription']);
    thenTheTabsFormATablist();
    thenTheSelectedTabIs('Overview');
    thenTheDisplayNameFieldHolds('Jane Reader');
    thenTheBioFieldHolds('I read a lot');
  });

  it('switching to the Bookmarks tab shows the Premium upsell for a free reader', async () => {
    await givenIAmOnMyProfile({ displayName: 'Jane Reader', bio: 'I read a lot' });

    await whenIOpenTheTab('Bookmarks');

    thenTheSelectedTabIs('Bookmarks');
    thenICanSee('Bookmarks are a Premium feature');
    thenMyBookmarksWereNotRequested();
  });

  it('saving the form calls PUT /profile and updates the AuthStore', async () => {
    await givenIAmOnMyProfile({ displayName: 'Jane Reader', bio: 'I read a lot' });

    whenITypeMyDisplayName('Jane R.');
    await whenISaveMyProfile({ savedAs: { displayName: 'Jane R.' } });

    thenTheSaveRequestWas('PUT', { displayName: 'Jane R.', bio: 'I read a lot', avatarUrl: null });
    thenMySessionDisplayNameIs('Jane R.');
    thenICanSee('Profile saved.');
  });

  it('keeps in-progress edits when the user object is refreshed, and re-seeds once saved', async () => {
    await givenIAmOnMyProfile({ displayName: 'Jane Reader', bio: 'I read a lot' });
    whenITypeMyDisplayName('Typing a new name');

    await whenMyProfileIsRefreshed({ displayName: 'Jane Reader', bio: 'Bio from the server' });

    thenTheDisplayNameFieldHolds('Typing a new name');
    thenTheBioFieldHolds('I read a lot');

    await whenISaveMyProfile({ savedAs: { displayName: 'Typing a new name', bio: 'Normalised bio' } });

    thenTheDisplayNameFieldHolds('Typing a new name');
    thenTheBioFieldHolds('Normalised bio');
  });

  it('re-seeds a pristine form when the profile is refreshed', async () => {
    await givenIAmOnMyProfile({ displayName: 'Jane Reader', bio: 'I read a lot' });

    await whenMyProfileIsRefreshed({ displayName: 'Jane Reader', bio: 'Updated elsewhere' });

    thenTheBioFieldHolds('Updated elsewhere');
  });

  async function givenIAmOnMyProfile(profile: Profile): Promise<void> {
    store.setUser(mockUser({ ...profile, username: 'jane' }));
    fixture = TestBed.createComponent(ProfilePage);
    await render();
  }

  async function whenIOpenTheTab(label: string): Promise<void> {
    tab(label).click();
    await render();
  }

  function whenITypeMyDisplayName(name: string): void {
    const input = one<HTMLInputElement>('#profile-display-name');
    input.value = name;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  async function whenISaveMyProfile(answer: { savedAs: Profile }): Promise<void> {
    one<HTMLFormElement>('form').dispatchEvent(new Event('submit', { cancelable: true }));
    await fixture.whenStable();
    lastRequest = http.expectOne(`${API}/profile`);
    lastRequest.flush(ok(mockUser({ ...answer.savedAs, username: 'jane' })));
    await fixture.whenStable();
    fixture.detectChanges();
  }

  /** Same user, new object: e.g. the AuthStore refreshing the user after a Stripe checkout. */
  async function whenMyProfileIsRefreshed(profile: Profile): Promise<void> {
    store.setUser(mockUser({ ...profile, username: 'jane' }));
    await render();
  }

  function thenTheHeaderShows(text: string): void {
    expect(one('h1').textContent).toContain(text);
  }

  function thenTheTabsAre(labels: string[]): void {
    expect(tabs().map((t) => t.textContent?.trim())).toEqual(labels);
  }

  function thenTheTabsFormATablist(): void {
    expect(one('[ngTabList]').getAttribute('role')).toBe('tablist');
  }

  function thenTheSelectedTabIs(label: string): void {
    expect(tab(label).getAttribute('aria-selected')).toBe('true');
  }

  function thenTheDisplayNameFieldHolds(value: string): void {
    expect(one<HTMLInputElement>('#profile-display-name').value).toBe(value);
  }

  function thenTheBioFieldHolds(value: string): void {
    expect(one<HTMLTextAreaElement>('#profile-bio').value).toBe(value);
  }

  function thenICanSee(text: string): void {
    expect(fixture.nativeElement.textContent).toContain(text);
  }

  function thenMyBookmarksWereNotRequested(): void {
    http.expectNone(`${API}/bookmarks`);
  }

  function thenTheSaveRequestWas(method: string, body: Record<string, unknown>): void {
    expect(lastRequest.request.method).toBe(method);
    expect(lastRequest.request.body).toMatchObject(body);
  }

  function thenMySessionDisplayNameIs(name: string): void {
    expect(store.user()?.displayName).toBe(name);
  }

  async function render(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function one<T extends HTMLElement>(selector: string): T {
    return fixture.nativeElement.querySelector(selector) as T;
  }

  function tabs(): HTMLElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('[ngTab]'));
  }

  function tab(label: string): HTMLElement {
    return tabs().find((t) => t.textContent?.trim() === label)!;
  }
});
