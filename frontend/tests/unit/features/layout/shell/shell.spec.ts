import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, DOCUMENT } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { Shell } from '@app/features/layout/shell/shell';
import { AuthStore } from '@app/core/auth/auth-store';
import { LayoutStore } from '@app/core/layout/layout-store';
import { Permission } from '@app/core/models/identity';
import { BrowserStorage } from '@app/core/storage/browser-storage';
import { THEME_KEY } from '@app/core/theme/theme-store';
import { mockUser, signIn } from '../../../core/auth/auth-fixtures';
import { MemoryStorage } from '../../../test-utils';

@Component({ template: '<h1>Page</h1>' })
class DummyPage {}

/** US-14 "Home and navigation": which entries exist. Which shape they take (tab bar or header) is CSS, checked end to end. */
describe('Shell navigation', () => {
  let fixture: ComponentFixture<Shell>;
  let http: HttpTestingController;
  let router: Router;
  let navigateByUrl: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Shell],
      providers: [
        provideRouter([
          { path: '', component: DummyPage },
          { path: 'works', component: DummyPage },
          { path: 'scanlation', component: DummyPage }
        ]),
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
  });

  afterEach(() => http.verify());

  it('The main sections are always one tap away', () => {
    givenIAmOnTheSite();

    thenTheNavigationLinksAre(['Home', 'Browse', 'Updates', 'Rankings', 'Lists']);
    thenEveryNavigationLinkHasAnHref();
    thenThereIsNoMenuButton();
    thenThereIsNoMenubar();
  });

  it('My library is in the navigation once I am signed in', async () => {
    givenIAmOnTheSite();
    thenTheNavigationLinksAre(['Home', 'Browse', 'Updates', 'Rankings', 'Lists']);

    await whenISignInAsAReaderWithALibrary();

    thenTheNavigationLinksAre(['Home', 'Browse', 'Updates', 'Rankings', 'Lists', 'Library']);
  });

  it('Team tools live in the account menu', async () => {
    givenIAmOnTheSite();
    await whenISignInWithoutTheNotificationBell(['PROJECT_VIEW', 'WORK_CREATE']);

    whenIOpenTheAccountMenu();

    thenTheAccountMenuOffers(['Profile', 'History', 'Subscription', 'Scanlation workspace', 'Upload Studio', 'Log out']);
    thenTheTeamToolsAreAGroupNamed('Team tools');
    thenTheNavigationLinksAre(['Home', 'Browse', 'Updates', 'Rankings', 'Lists']);
  });

  it('a reader has no team tools in the account menu', async () => {
    givenIAmOnTheSite();
    await whenISignInWithoutTheNotificationBell([]);

    whenIOpenTheAccountMenu();

    thenTheAccountMenuOffers(['Profile', 'History', 'Subscription', 'Log out']);
  });

  it('navigates exactly once per click and marks the current page', async () => {
    givenIAmOnTheSite();

    await whenIClickTheNavigationLink('Browse');

    thenTheRouterNavigatedTimes(1);
    thenIAmOn('/works');
    thenTheCurrentPageLinkIs('Browse');
  });

  it('hides the site header, footer and tab bar in the reader zen mode', () => {
    givenIAmOnTheSite();

    whenTheReaderSwitchesZenMode(true);

    thenTheLayoutIsImmersive(true);
    thenTheTabBarIsHidden(true);

    whenTheReaderSwitchesZenMode(false);

    thenTheLayoutIsImmersive(false);
    thenTheTabBarIsHidden(false);
  });

  it('hides the tab bar while a page asks for the whole screen (the reader)', () => {
    givenIAmOnTheSite();

    whenAPageAsksForTheWholeScreen(true);

    thenTheTabBarIsHidden(true);
  });

  it('after moving to another page, focus goes to its heading', async () => {
    givenIAmOnTheSite();
    await givenIHaveOpened('/');

    await whenINavigateTo('/works');

    thenTheFocusIsOnThePageHeading();
  });

  it('changing only the query string keeps the focus where it is', async () => {
    givenIAmOnTheSite();
    await givenIHaveOpened('/works');
    givenTheFocusIsOnTheNavigationLink('Browse');

    await whenINavigateTo('/works?genre=Action');

    thenTheFocusIsOnTheNavigationLink('Browse');
  });

  it('the first page load does not move the focus', async () => {
    givenIAmOnTheSite();

    await whenINavigateTo('/works');

    thenTheFocusIsNotOnThePageHeading();
  });

  it('logging out from the account menu ends the session and goes home', async () => {
    givenIAmOnTheSite();
    await givenIHaveOpened('/works');
    await whenISignInWithoutTheNotificationBell([]);

    await whenILogOutFromTheAccountMenu();

    thenIAmOn('/');
    thenICanLogIn();
  });

  function givenIAmOnTheSite(): void {
    fixture = TestBed.createComponent(Shell);
    fixture.detectChanges();
  }

  async function givenIHaveOpened(url: string): Promise<void> {
    await whenINavigateTo(url);
  }

  function givenTheFocusIsOnTheNavigationLink(label: string): void {
    link(label).focus();
  }

  async function whenINavigateTo(url: string): Promise<void> {
    await router.navigateByUrl(url);
    fixture.detectChanges();
    await fixture.whenStable();
  }

  async function whenIClickTheNavigationLink(label: string): Promise<void> {
    navigateByUrl = vi.spyOn(router, 'navigateByUrl');
    link(label).click();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  /** Without `LIBRARY_USE` there is no notification bell, which polls the API and has its own spec. */
  async function whenISignInWithoutTheNotificationBell(permissions: Permission[]): Promise<void> {
    await signIn(TestBed.inject(AuthStore), http, mockUser({ permissions }));
    fixture.detectChanges();
  }

  async function whenISignInAsAReaderWithALibrary(): Promise<void> {
    await signIn(TestBed.inject(AuthStore), http, mockUser({ permissions: ['LIBRARY_USE'] }));
    fixture.detectChanges();
    // The bell of a reader with a library asks for the unread count; it has its own spec.
    http.match((request) => request.url.includes('/notifications')).forEach((request) => request.flush({ success: true, data: 0 }));
  }

  function whenIOpenTheAccountMenu(): void {
    fixture.nativeElement.querySelector('button[aria-label="Account menu"]').click();
    fixture.detectChanges();
  }

  async function whenILogOutFromTheAccountMenu(): Promise<void> {
    whenIOpenTheAccountMenu();
    menuItems().find((item) => item.textContent?.trim() === 'Log out')!.click();
    http.expectOne((r) => r.method === 'POST' && r.url.endsWith('/auth/logout')).flush({ success: true, data: null });
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function whenTheReaderSwitchesZenMode(on: boolean): void {
    TestBed.inject(LayoutStore).setImmersive(on);
    fixture.detectChanges();
  }

  function whenAPageAsksForTheWholeScreen(on: boolean): void {
    TestBed.inject(LayoutStore).setTabBarHidden(on);
    fixture.detectChanges();
  }

  function thenTheFocusIsOnThePageHeading(): void {
    expect(document.activeElement).toBe(fixture.nativeElement.querySelector('main h1'));
  }

  function thenTheFocusIsNotOnThePageHeading(): void {
    expect(document.activeElement).not.toBe(fixture.nativeElement.querySelector('main h1'));
  }

  function thenTheFocusIsOnTheNavigationLink(label: string): void {
    expect(document.activeElement).toBe(link(label));
  }

  function thenThereIsNoMenubar(): void {
    expect(fixture.nativeElement.querySelector('[role="menubar"]')).toBeNull();
  }

  function thenThereIsNoMenuButton(): void {
    expect(fixture.nativeElement.querySelector('button[aria-controls="primary-nav"]')).toBeNull();
  }

  function thenTheNavigationLinksAre(labels: string[]): void {
    expect(links().map((a) => a.textContent?.trim())).toEqual(labels);
  }

  function thenEveryNavigationLinkHasAnHref(): void {
    expect(links().every((a) => a.getAttribute('href'))).toBe(true);
  }

  function thenTheAccountMenuOffers(labels: string[]): void {
    expect(menuItems().map((item) => item.textContent?.trim())).toEqual(labels);
  }

  function thenTheTeamToolsAreAGroupNamed(name: string): void {
    const group: HTMLElement = fixture.nativeElement.querySelector('[role="menu"] [role="group"]');
    expect(group.getAttribute('aria-label')).toBe(name);
    expect(Array.from(group.querySelectorAll('[role="menuitem"]')).map((item) => item.textContent?.trim())).toEqual(['Scanlation workspace', 'Upload Studio']);
  }

  function thenTheRouterNavigatedTimes(times: number): void {
    expect(navigateByUrl).toHaveBeenCalledTimes(times);
  }

  function thenIAmOn(url: string): void {
    expect(router.url).toBe(url);
  }

  function thenICanLogIn(): void {
    expect(fixture.nativeElement.querySelector('a[href="/login"]')?.textContent.trim()).toBe('Log in');
  }

  function thenTheCurrentPageLinkIs(label: string): void {
    expect(link(label).getAttribute('aria-current')).toBe('page');
  }

  function thenTheLayoutIsImmersive(immersive: boolean): void {
    expect(fixture.nativeElement.querySelector('.app-layout').classList.contains('immersive')).toBe(immersive);
  }

  function thenTheTabBarIsHidden(hidden: boolean): void {
    expect(fixture.nativeElement.querySelector('app-primary-nav').classList.contains('tabbar-hidden')).toBe(hidden);
  }

  function menuItems(): HTMLElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('[role="menuitem"]'));
  }

  function links(): HTMLAnchorElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('nav[aria-label="Primary"] a'));
  }

  function link(label: string): HTMLAnchorElement {
    return links().find((a) => a.textContent?.trim() === label)!;
  }
});

describe('Shell theme switch', () => {
  let fixture: ComponentFixture<Shell>;
  let storage: MemoryStorage;

  beforeEach(async () => {
    storage = new MemoryStorage();
    await TestBed.configureTestingModule({
      imports: [Shell],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), { provide: BrowserStorage, useValue: storage }]
    }).compileComponents();
  });

  afterEach(() => TestBed.inject(DOCUMENT).documentElement.removeAttribute('data-theme'));

  it('switches to the light theme and back from the header, and remembers the choice', () => {
    givenIAmOnTheSite();
    thenThePageThemeIs('dark');

    whenIPressTheHeaderButton('Switch to the light theme');

    thenThePageThemeIs('light');
    thenMyThemeChoiceIsSaved('light');

    whenIPressTheHeaderButton('Switch to the dark theme');

    thenThePageThemeIs('dark');
    thenMyThemeChoiceIsSaved('dark');
  });

  function givenIAmOnTheSite(): void {
    fixture = TestBed.createComponent(Shell);
    fixture.detectChanges();
  }

  function whenIPressTheHeaderButton(label: string): void {
    fixture.nativeElement.querySelector(`header button[aria-label="${label}"]`).click();
    fixture.detectChanges();
  }

  function thenThePageThemeIs(theme: string | null): void {
    expect(TestBed.inject(DOCUMENT).documentElement.getAttribute('data-theme')).toBe(theme);
  }

  function thenMyThemeChoiceIsSaved(value: string): void {
    expect(storage.read(THEME_KEY)).toBe(value);
  }
});
