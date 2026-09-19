import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { Shell } from '@app/features/layout/shell/shell';
import { AuthStore } from '@app/core/auth/auth-store';
import { LayoutStore } from '@app/core/layout/layout-store';
import { Permission } from '@app/core/models/readora.models';
import { mockUser, signIn } from '../../../core/auth/auth-fixtures';

@Component({ template: '<h1>Page</h1>' })
class DummyPage {}

describe('Shell primary navigation', () => {
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

  it('is a list of links, not an ARIA menubar', () => {
    givenIAmOnTheSite();

    thenThereIsNoMenubar();
    thenTheNavigationLinksAre(['Home', 'Catalog', 'Updates', 'Rankings', 'Lists']);
    thenEveryNavigationLinkHasAnHref();
  });

  it('navigates exactly once per click and marks the current page', async () => {
    givenIAmOnTheSite();

    await whenIClickTheNavigationLink('Catalog');

    thenTheRouterNavigatedTimes(1);
    thenIAmOn('/works');
    thenTheCurrentPageLinkIs('Catalog');
  });

  it('shows permission-gated entries only to allowed users', async () => {
    givenIAmOnTheSite();

    await whenISignInWith(['PROJECT_VIEW']);

    thenTheNavigationLinksAre(['Home', 'Catalog', 'Updates', 'Rankings', 'Lists', 'Scanlation']);
  });

  it('hides the site header and footer in the reader zen mode', () => {
    givenIAmOnTheSite();

    whenTheReaderSwitchesZenMode(true);

    thenTheLayoutIsImmersive(true);

    whenTheReaderSwitchesZenMode(false);

    thenTheLayoutIsImmersive(false);
  });

  it('on small screens the navigation is a disclosure opened by the Menu button', () => {
    givenIAmOnTheSite();

    thenTheNavigationIsOpen(false);

    whenIPressTheMenuButton();

    thenTheNavigationIsOpen(true);

    whenIPressTheMenuButton();

    thenTheNavigationIsOpen(false);
  });

  it('Escape closes the open navigation and gives focus back to the Menu button', () => {
    givenIAmOnTheSite();
    whenIPressTheMenuButton();

    whenIPressEscapeInTheNavigation();

    thenTheNavigationIsOpen(false);
    thenTheMenuButtonHasFocus();
  });

  it('choosing a page closes the navigation', async () => {
    givenIAmOnTheSite();
    whenIPressTheMenuButton();

    await whenIClickTheNavigationLink('Catalog');

    thenIAmOn('/works');
    thenTheNavigationIsOpen(false);
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
    givenTheFocusIsOnTheNavigationLink('Catalog');

    await whenINavigateTo('/works?genre=Action');

    thenTheFocusIsOnTheNavigationLink('Catalog');
  });

  it('the first page load does not move the focus', async () => {
    givenIAmOnTheSite();

    await whenINavigateTo('/works');

    thenTheFocusIsNotOnThePageHeading();
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

  async function whenISignInWith(permissions: Permission[]): Promise<void> {
    await signIn(TestBed.inject(AuthStore), http, mockUser({ permissions }));
    fixture.detectChanges();
  }

  function whenTheReaderSwitchesZenMode(on: boolean): void {
    TestBed.inject(LayoutStore).setImmersive(on);
    fixture.detectChanges();
  }

  function whenIPressTheMenuButton(): void {
    menuButton().click();
    fixture.detectChanges();
  }

  function whenIPressEscapeInTheNavigation(): void {
    links()[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
  }

  function thenTheNavigationIsOpen(open: boolean): void {
    expect(menuButton().getAttribute('aria-expanded')).toBe(String(open));
    expect(fixture.nativeElement.querySelector('#primary-nav').classList.contains('nav-open')).toBe(open);
  }

  function thenTheMenuButtonHasFocus(): void {
    expect(document.activeElement).toBe(menuButton());
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

  function thenTheNavigationLinksAre(labels: string[]): void {
    expect(links().map((a) => a.textContent?.trim())).toEqual(labels);
  }

  function thenEveryNavigationLinkHasAnHref(): void {
    expect(links().every((a) => a.getAttribute('href'))).toBe(true);
  }

  function thenTheRouterNavigatedTimes(times: number): void {
    expect(navigateByUrl).toHaveBeenCalledTimes(times);
  }

  function thenIAmOn(url: string): void {
    expect(router.url).toBe(url);
  }

  function thenTheCurrentPageLinkIs(label: string): void {
    expect(link(label).getAttribute('aria-current')).toBe('page');
  }

  function thenTheLayoutIsImmersive(immersive: boolean): void {
    expect(fixture.nativeElement.querySelector('.app-layout').classList.contains('immersive')).toBe(immersive);
  }

  function menuButton(): HTMLButtonElement {
    return fixture.nativeElement.querySelector('button[aria-controls="primary-nav"]');
  }

  function links(): HTMLAnchorElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('nav[aria-label="Primary"] a'));
  }

  function link(label: string): HTMLAnchorElement {
    return links().find((a) => a.textContent?.trim() === label)!;
  }
});
