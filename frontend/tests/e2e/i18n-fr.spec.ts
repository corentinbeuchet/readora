import { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { test, expect } from './support/fixtures';
import { PUBLISHER, PublishingTeam, publishChapter, thenNoNavigationLabelIsClipped, thenTheFactIs } from './support/helpers';

/**
 * US-13 on the French build (project `chromium-fr`, base URL `/fr/` or the French dev server). Paths are relative
 * (`works`, not `/works`) so they stay under the build's base URL.
 */
test.describe('French interface (US-13)', () => {
  test('the site speaks French: language, navigation and page titles', async ({ page }) => {
    await whenIVisit(page, 'works');

    await thenThePageLanguageIs(page, 'fr');
    await thenTheMainHeadingIs(page, 'Catalogue');
    await thenTheNavigationOffers(page, 'Nouveautés');
  });

  test('a refused login is explained in French', async ({ page }) => {
    await whenIVisit(page, 'login');
    await whenILogInWith(page, { email: 'reader@readora.local', password: 'wrong-password' });

    await thenISeeTheAlert(page, 'E-mail ou mot de passe incorrect.');
  });

  test('French pages have no axe violations', async ({ page, axe }) => {
    for (const url of ['', 'works', 'login', 'subscription']) {
      await whenIVisit(page, url);

      await thenAxeFindsNoViolations(axe());
    }
  });

  test('a series translated by two teams reads in French and fits a 320px screen', async ({ page, axe, seriesByTwoTeams }) => {
    await givenMyScreenIsNarrow(page);

    await whenIVisit(page, `works/${seriesByTwoTeams.workId}`);

    await thenTheSeriesIsTranslatedBy(page, seriesByTwoTeams.firstTeam, '3 chapitres');
    await thenTheSeriesIsTranslatedBy(page, seriesByTwoTeams.secondTeam, '2 chapitres');
    await thenThereIsTheLink(page, `Lire le chapitre 1 par ${seriesByTwoTeams.secondTeam.name}`);
    await thenThePageDoesNotScrollSideways(page, 'the series page');
    await thenAxeFindsNoViolations(axe());

    await whenIOpenTheChapter(page, seriesByTwoTeams.firstTeam.chapterIds['1']);

    await thenThereIsTheLink(page, `Lire ce chapitre par ${seriesByTwoTeams.secondTeam.name}`);
    await thenThePageDoesNotScrollSideways(page, 'the reader');
  });

  test('series facts and the form that edits them read in French and fit a 320px screen', async ({ page, axe, seriesWithFacts }) => {
    await givenMyScreenIsNarrow(page);

    await whenIVisit(page, `works/${seriesWithFacts.workId}`);

    await thenTheFactIs(page, 'Autres titres', seriesWithFacts.otherTitles);
    await thenTheFactIs(page, 'Dessin', ['E2E Artist']);
    await thenTheFactIs(page, "Langue d'origine", ['Japonais']);
    await thenThePageDoesNotScrollSideways(page, 'the series page');

    await whenIVisit(page, 'login');
    await whenILogInWith(page, PUBLISHER);
    await whenIEditTheSeries(page, seriesWithFacts.workId);
    await whenISaveTheYear(page, '19');

    await thenTheMainHeadingIs(page, 'Modifier la série');
    await thenISeeTheText(page, 'Saisissez une année entre 1900 et 2100, ou laissez le champ vide');
    await thenThePageDoesNotScrollSideways(page, 'the edit form');
    await thenAxeFindsNoViolations(axe());
  });

  test('longer French labels still fit a 320px screen', async ({ page, request }) => {
    const chapter = await publishChapter(request);
    await givenMyScreenIsNarrow(page);

    for (const url of ['', 'works', 'login', 'register', 'subscription', `works/${chapter.workId}`]) {
      await whenIVisit(page, url);

      await thenThePageDoesNotScrollSideways(page, url);
    }

    await thenNoNavigationLabelIsClipped(page, 'Principale');
  });
});

async function givenMyScreenIsNarrow(page: Page): Promise<void> {
  await page.setViewportSize({ width: 320, height: 640 });
}

async function whenIVisit(page: Page, url: string): Promise<void> {
  await page.goto(url);
  await expect(page.locator('main h1').first()).toBeVisible();
}

async function whenILogInWith(page: Page, credentials: { email: string; password: string }): Promise<void> {
  await page.getByLabel('E-mail').fill(credentials.email);
  await page.getByLabel('Mot de passe').fill(credentials.password);
  await page.getByRole('button', { name: 'Se connecter' }).last().click();
}

/** Waits for the chapter's links: the reader shows a placeholder heading while the chapter loads. */
async function whenIOpenTheChapter(page: Page, chapterId: string): Promise<void> {
  await page.goto(`read/${chapterId}`);
  await expect(page.getByRole('link', { name: /^Traduit par/ })).toBeVisible();
}

/** The account menu is there once the login went through; the form itself only arrives with the series. */
async function whenIEditTheSeries(page: Page, workId: string): Promise<void> {
  await expect(page.getByRole('button', { name: 'Menu du compte' })).toBeVisible();
  await page.goto(`scanlation/series/${workId}`);
  await expect(page.getByLabel('Dessin')).toHaveValue('E2E Artist');
}

async function whenISaveTheYear(page: Page, year: string): Promise<void> {
  await page.getByLabel('Première parution (année)').fill(year);
  await page.getByRole('button', { name: 'Enregistrer la série' }).click();
}

async function thenTheSeriesIsTranslatedBy(page: Page, team: PublishingTeam, chapters: string): Promise<void> {
  const entry = page.getByRole('region', { name: 'Traduit par' }).getByRole('listitem').filter({ hasText: team.name });
  await expect(entry).toContainText(chapters);
}

async function thenThereIsTheLink(page: Page, name: string): Promise<void> {
  await expect(page.getByRole('link', { name })).toBeVisible();
}

async function thenISeeTheText(page: Page, text: string): Promise<void> {
  await expect(page.getByText(text)).toBeVisible();
}

async function thenThePageLanguageIs(page: Page, lang: string): Promise<void> {
  await expect(page.locator('html')).toHaveAttribute('lang', lang);
}

async function thenTheMainHeadingIs(page: Page, text: string): Promise<void> {
  await expect(page.locator('main h1').first()).toHaveText(text);
}

async function thenTheNavigationOffers(page: Page, label: string): Promise<void> {
  await expect(page.getByRole('navigation', { name: 'Principale' }).getByRole('link', { name: label })).toBeAttached();
}

async function thenISeeTheAlert(page: Page, text: string): Promise<void> {
  await expect(page.getByRole('alert').filter({ hasText: text })).toBeVisible();
}

async function thenAxeFindsNoViolations(scan: AxeBuilder): Promise<void> {
  const { violations } = await scan.analyze();
  expect(violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
}

async function thenThePageDoesNotScrollSideways(page: Page, url: string): Promise<void> {
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), {
      message: `/fr/${url} is wider than the screen`,
      timeout: 5000
    })
    .toBeLessThanOrEqual(0);
}
