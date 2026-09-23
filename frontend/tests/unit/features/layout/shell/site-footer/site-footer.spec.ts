import { DOCUMENT } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SiteFooter } from '@app/features/layout/shell/site-footer/site-footer';
import { BrowserStorage } from '@app/core/storage/browser-storage';
import { THEME_KEY } from '@app/core/theme/theme-store';
import { MemoryStorage } from '../../../../test-utils';

describe('SiteFooter', () => {
  let fixture: ComponentFixture<SiteFooter>;
  let storage: MemoryStorage;

  beforeEach(() => {
    storage = new MemoryStorage();
    TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: BrowserStorage, useValue: storage }] });
  });

  afterEach(() => TestBed.inject(DOCUMENT).documentElement.removeAttribute('data-theme'));

  it('is dark by default; choosing Light pins it and is remembered', () => {
    givenIAmOnThePage('/works');

    thenTheThemePickerShows('dark');
    thenThePageThemeIs('dark');

    whenIChooseTheTheme('light');

    thenThePageThemeIs('light');
    thenMyThemeChoiceIsSaved('light');
  });

  it('choosing System follows the device again', () => {
    givenIAmOnThePage('/works');

    whenIChooseTheTheme('system');

    thenThePageThemeIs(null);
    thenMyThemeChoiceIsSaved('system');
  });

  it('offers the sections again, and the same page in French', () => {
    givenIAmOnThePage('/works?genre=Action');

    thenTheSectionLinksGoTo(['/works', '/updates', '/rankings', '/lists']);
    thenTheLanguageLinkPointsTo('Français', '/fr/works?genre=Action');
  });

  function givenIAmOnThePage(url: string): void {
    fixture = TestBed.createComponent(SiteFooter);
    fixture.componentRef.setInput('url', url);
    fixture.detectChanges();
  }

  function whenIChooseTheTheme(value: string): void {
    themePicker().value = value;
    themePicker().dispatchEvent(new Event('change'));
    fixture.detectChanges();
  }

  function thenTheThemePickerShows(value: string): void {
    expect(themePicker().value).toBe(value);
  }

  function thenThePageThemeIs(theme: string | null): void {
    expect(TestBed.inject(DOCUMENT).documentElement.getAttribute('data-theme')).toBe(theme);
  }

  function thenMyThemeChoiceIsSaved(value: string): void {
    expect(storage.read(THEME_KEY)).toBe(value);
  }

  function thenTheSectionLinksGoTo(paths: string[]): void {
    const links: HTMLAnchorElement[] = Array.from(fixture.nativeElement.querySelectorAll('nav[aria-label="Sections"] a'));
    expect(links.map((a) => a.getAttribute('href'))).toEqual(paths);
  }

  function thenTheLanguageLinkPointsTo(label: string, href: string): void {
    const links: HTMLAnchorElement[] = Array.from(fixture.nativeElement.querySelectorAll('nav[aria-label="Language"] a'));
    expect(links.find((a) => a.textContent?.trim() === label)?.getAttribute('href')).toBe(href);
  }

  function themePicker(): HTMLSelectElement {
    const labels: HTMLLabelElement[] = Array.from(fixture.nativeElement.querySelectorAll('footer label'));
    return labels.find((label) => label.textContent?.includes('Theme'))!.querySelector('select')!;
  }
});
