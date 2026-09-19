import { Component, LOCALE_ID } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { registerLocaleData } from '@angular/common';
import localeFr from '@angular/common/locales/fr';
import { provideRouter, Router } from '@angular/router';
import { clearTranslations, loadTranslations } from '@angular/localize';
import { PlansPage } from '@app/features/subscription/plans-page/plans-page';
import { LoginPage } from '@app/features/auth/login-page/login-page';
import { Shell } from '@app/features/layout/shell/shell';
import { FRENCH } from './french-translations';
import { API, fail, provideHttpTesting } from '../test-utils';

@Component({ template: '<h1>Series</h1>' })
class SeriesPage {}

/**
 * US-13 @ui scenarios. The real French file is loaded at run time (`loadTranslations`), standing in for the French
 * build, which inlines the same texts at compile time. Its own spec file: runtime translations must not leak into
 * specs that assert the English source text.
 */
describe('US-13 Reading Readora in my language', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<unknown>;

  afterEach(() => {
    http?.verify();
    clearTranslations();
  });

  it('The French site shows French text, dates and prices', () => {
    givenIUseTheFrenchSite();

    whenIOpen(PlansPage);

    thenThePageTitleIs('Choisissez votre formule');
    thenThePremiumPriceReads('4,99 €');
  });

  it('Switching language keeps the current page', async () => {
    givenIUseTheEnglishSite();

    await whenIBrowseTo('/works/solo-leveling');

    thenTheLanguageLinkPointsTo('Français', '/fr/works/solo-leveling');
  });

  it('Errors from the server are shown in my language', async () => {
    givenIUseTheFrenchSite();
    givenIAmOn(LoginPage);

    await whenTheServerRefusesTheLoginWithCode('INVALID_CREDENTIALS');

    thenISeeTheAlert('E-mail ou mot de passe incorrect.');
  });

  it('Counts of zero and one read as singular in French', () => {
    thenEveryFrenchPluralHasZeroAndOneForms();
  });

  function givenIUseTheFrenchSite(): void {
    registerLocaleData(localeFr);
    loadTranslations(FRENCH);
    configure('fr');
  }

  function givenIUseTheEnglishSite(): void {
    configure('en');
  }

  function configure(locale: string): void {
    TestBed.configureTestingModule({
      providers: [
        { provide: LOCALE_ID, useValue: locale },
        provideRouter([{ path: 'works/:id', component: SeriesPage }]),
        ...provideHttpTesting()
      ]
    });
    http = TestBed.inject(HttpTestingController);
  }

  function givenIAmOn(page: new (...args: never[]) => unknown): void {
    whenIOpen(page);
  }

  function whenIOpen(page: new (...args: never[]) => unknown): void {
    fixture = TestBed.createComponent(page);
    fixture.detectChanges();
  }

  async function whenIBrowseTo(url: string): Promise<void> {
    whenIOpen(Shell);
    await TestBed.inject(Router).navigateByUrl(url);
    fixture.detectChanges();
  }

  async function whenTheServerRefusesTheLoginWithCode(code: string): Promise<void> {
    typeInto('#login-email', 'camille@readora.test');
    typeInto('#login-password', 'wrong-password');
    fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit', { cancelable: true }));
    http.expectOne(`${API}/auth/login`).flush(fail('Invalid email or password', code), { status: 401, statusText: 'Unauthorized' });
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function thenThePageTitleIs(title: string): void {
    expect(text(fixture.nativeElement.querySelector('h1'))).toBe(title);
  }

  function thenThePremiumPriceReads(price: string): void {
    const prices: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('.price'));
    expect(prices.map(text).some((shown) => shown.startsWith(price))).toBe(true);
  }

  function thenTheLanguageLinkPointsTo(label: string, href: string): void {
    const links: HTMLAnchorElement[] = Array.from(fixture.nativeElement.querySelectorAll('footer nav a'));
    expect(links.find((link) => link.textContent?.trim() === label)?.getAttribute('href')).toBe(href);
  }

  function thenISeeTheAlert(message: string): void {
    expect(text(fixture.nativeElement.querySelector('[role="alert"]'))).toBe(message);
  }

  /**
   * French counts 0 as singular ("0 page"), so `other` alone would print "0 pages"; and a word that doesn't change
   * in English ("1 series") still does in French ("1 série").
   */
  function thenEveryFrenchPluralHasZeroAndOneForms(): void {
    const incomplete = Object.entries(FRENCH)
      .filter(([, message]) => message.includes(', plural,') && !(message.includes('=0 {') && message.includes('=1 {')))
      .map(([id]) => id);
    expect(incomplete).toEqual([]);
  }

  function typeInto(selector: string, value: string): void {
    const input = fixture.nativeElement.querySelector(selector) as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  /** Text with the narrow and regular no-break spaces French formatting uses turned into plain spaces. */
  function text(element: Element | null): string {
    return (element?.textContent ?? '').replace(/[\u00a0\u202f]/g, ' ').replace(/\s+/g, ' ').trim();
  }
});
