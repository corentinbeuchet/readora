import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PrimaryNav } from '@app/features/layout/shell/primary-nav/primary-nav';
import { provideHttpTesting } from '../../../../test-utils';

describe('PrimaryNav', () => {
  let fixture: ComponentFixture<PrimaryNav>;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([]), ...provideHttpTesting()] });
  });

  it('is one navigation landmark holding a list of links', () => {
    givenTheNavigationIsShown();

    thenThereIsOneNavigationNamed('Primary');
    thenTheLinksGoTo(['/', '/works', '/updates', '/rankings', '/lists']);
  });

  it('names every entry with its text: the icons are decoration', () => {
    givenTheNavigationIsShown();

    thenEveryLinkHasAVisibleLabel();
    thenEveryIconIsHiddenFromAssistiveTechnology();
  });

  it('marks Home and Lists, the entries the layout hides (computer header, signed-in tab bar)', () => {
    givenTheNavigationIsShown();

    thenTheEntryIsMarked('Home', 'nav-home');
    thenTheEntryIsMarked('Lists', 'nav-lists');
  });

  function givenTheNavigationIsShown(): void {
    fixture = TestBed.createComponent(PrimaryNav);
    fixture.detectChanges();
  }

  function thenThereIsOneNavigationNamed(name: string): void {
    const navigations: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('nav'));
    expect(navigations.map((nav) => nav.getAttribute('aria-label'))).toEqual([name]);
  }

  function thenTheLinksGoTo(paths: string[]): void {
    expect(links().map((a) => a.getAttribute('href'))).toEqual(paths);
  }

  function thenEveryLinkHasAVisibleLabel(): void {
    expect(links().every((a) => a.querySelector('.nav-label')?.textContent?.trim())).toBe(true);
  }

  function thenEveryIconIsHiddenFromAssistiveTechnology(): void {
    const icons: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('app-icon'));
    expect(icons.map((icon) => icon.getAttribute('aria-hidden'))).toEqual(links().map(() => 'true'));
  }

  function thenTheEntryIsMarked(label: string, className: string): void {
    const entry = links().find((a) => a.textContent?.trim() === label)!.closest('li')!;
    expect(entry.classList.contains(className)).toBe(true);
  }

  function links(): HTMLAnchorElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('nav a'));
  }
});
