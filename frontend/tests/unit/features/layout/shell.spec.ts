import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { Shell } from '@app/features/layout/shell';
import { AuthStore } from '@app/core/auth/auth-store';
import { LayoutStore } from '@app/core/layout/layout-store';
import { Permission } from '@app/core/models/readora.models';
import { mockUser, signIn } from '../../core/auth/auth-fixtures';

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

  function givenIAmOnTheSite(): void {
    fixture = TestBed.createComponent(Shell);
    fixture.detectChanges();
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

  function links(): HTMLAnchorElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('nav[aria-label="Primary"] a'));
  }

  function link(label: string): HTMLAnchorElement {
    return links().find((a) => a.textContent?.trim() === label)!;
  }
});
