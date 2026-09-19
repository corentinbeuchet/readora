import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { ProfilePage } from '@app/features/profile/profile-page';
import { AuthStore } from '@app/core/auth/auth-store';
import { environment } from '../../../../src/environments/environment';
import { mockUser } from '../../core/auth/auth-fixtures';

describe('ProfilePage (Angular Aria Tabs + Signal Forms)', () => {
  let fixture: ComponentFixture<ProfilePage>;
  let http: HttpTestingController;
  let store: AuthStore;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProfilePage],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()]
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    store = TestBed.inject(AuthStore);
    store.setUser(mockUser({ displayName: 'Jane Reader', bio: 'I read a lot', username: 'jane' }));
    fixture = TestBed.createComponent(ProfilePage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  const all = (selector: string): HTMLElement[] => Array.from(fixture.nativeElement.querySelectorAll(selector));
  const one = <T extends HTMLElement>(selector: string): T => fixture.nativeElement.querySelector(selector) as T;

  it('renders the header, three tabs and the pre-filled profile form on the Overview tab', () => {
    expect(one('h1').textContent).toContain('Jane Reader');
    const tabs = all('[ngTab]');
    expect(tabs.map((t) => t.textContent?.trim())).toEqual(['Overview', 'Bookmarks', 'Subscription']);
    expect(one('[ngTabList]').getAttribute('role')).toBe('tablist');
    expect(tabs[0].getAttribute('aria-selected')).toBe('true');

    expect(one<HTMLInputElement>('#profile-display-name').value).toBe('Jane Reader');
    expect(one<HTMLTextAreaElement>('#profile-bio').value).toBe('I read a lot');
  });

  it('switching to the Bookmarks tab shows the Premium upsell for a free reader', async () => {
    all('[ngTab]')[1].click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(all('[ngTab]')[1].getAttribute('aria-selected')).toBe('true');
    expect(fixture.nativeElement.textContent).toContain('Bookmarks are a Premium feature');
    http.expectNone(`${environment.apiUrl}/bookmarks`);
  });

  it('saving the form calls PUT /profile and updates the AuthStore', async () => {
    const input = one<HTMLInputElement>('#profile-display-name');
    input.value = 'Jane R.';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    one<HTMLFormElement>('form').dispatchEvent(new Event('submit', { cancelable: true }));
    await fixture.whenStable();

    const req = http.expectOne(`${environment.apiUrl}/profile`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toMatchObject({ displayName: 'Jane R.', bio: 'I read a lot', avatarUrl: null });
    req.flush({ success: true, data: mockUser({ displayName: 'Jane R.', username: 'jane' }), error: null });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(store.user()?.displayName).toBe('Jane R.');
    expect(fixture.nativeElement.textContent).toContain('Profile saved.');
  });

  it('keeps in-progress edits when the user object is refreshed, and re-seeds once saved', async () => {
    const name = one<HTMLInputElement>('#profile-display-name');
    name.value = 'Typing a new name';
    name.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    // e.g. AuthStore refreshing the user after a Stripe checkout: same user, new object.
    store.setUser(mockUser({ displayName: 'Jane Reader', bio: 'Bio from the server', username: 'jane' }));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(one<HTMLInputElement>('#profile-display-name').value).toBe('Typing a new name');
    expect(one<HTMLTextAreaElement>('#profile-bio').value).toBe('I read a lot');

    one<HTMLFormElement>('form').dispatchEvent(new Event('submit', { cancelable: true }));
    await fixture.whenStable();
    http.expectOne(`${environment.apiUrl}/profile`).flush({
      success: true,
      data: mockUser({ displayName: 'Typing a new name', bio: 'Normalised bio', username: 'jane' }),
      error: null
    });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(one<HTMLInputElement>('#profile-display-name').value).toBe('Typing a new name');
    expect(one<HTMLTextAreaElement>('#profile-bio').value).toBe('Normalised bio');
  });

  it('re-seeds a pristine form when the profile is refreshed', async () => {
    store.setUser(mockUser({ displayName: 'Jane Reader', bio: 'Updated elsewhere', username: 'jane' }));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(one<HTMLTextAreaElement>('#profile-bio').value).toBe('Updated elsewhere');
  });
});
