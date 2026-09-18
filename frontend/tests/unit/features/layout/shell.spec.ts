import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { Shell } from '@app/features/layout/shell';
import { AuthStore } from '@app/core/auth/auth-store';
import { LayoutStore } from '@app/core/layout/layout-store';
import { mockUser, signIn } from '../../core/auth/auth-fixtures';

@Component({ template: '<h1>Page</h1>' })
class DummyPage {}

describe('Shell primary navigation', () => {
  let fixture: ComponentFixture<Shell>;
  let http: HttpTestingController;
  let router: Router;

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
    fixture = TestBed.createComponent(Shell);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  const links = (): HTMLAnchorElement[] => Array.from(fixture.nativeElement.querySelectorAll('nav[aria-label="Primary"] a'));

  it('is a list of links, not an ARIA menubar', () => {
    expect(fixture.nativeElement.querySelector('[role="menubar"]')).toBeNull();
    expect(links().map((a) => a.textContent?.trim())).toEqual(['Home', 'Catalog']);
    expect(links().every((a) => a.getAttribute('href'))).toBe(true);
  });

  it('navigates exactly once per click and marks the current page', async () => {
    const navigate = vi.spyOn(router, 'navigateByUrl');
    links()[1].click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(navigate).toHaveBeenCalledTimes(1);
    expect(router.url).toBe('/works');
    expect(links()[1].getAttribute('aria-current')).toBe('page');
  });

  it('shows permission-gated entries only to allowed users', async () => {
    await signIn(TestBed.inject(AuthStore), http, mockUser({ permissions: ['PROJECT_VIEW'] }));
    fixture.detectChanges();
    expect(links().map((a) => a.textContent?.trim())).toEqual(['Home', 'Catalog', 'Scanlation']);
  });

  it('hides the site header and footer in the reader zen mode', () => {
    TestBed.inject(LayoutStore).setImmersive(true);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.app-layout').classList).toContain('immersive');

    TestBed.inject(LayoutStore).setImmersive(false);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.app-layout').classList).not.toContain('immersive');
  });
});
