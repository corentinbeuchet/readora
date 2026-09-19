import { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { test, expect } from './support/fixtures';
import { publishChapter } from './support/helpers';

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

  test('longer French labels still fit a 320px screen', async ({ page, request }) => {
    const chapter = await publishChapter(request);
    await givenMyScreenIsNarrow(page);

    for (const url of ['', 'works', 'login', 'register', 'subscription', `works/${chapter.workId}`]) {
      await whenIVisit(page, url);

      await thenThePageDoesNotScrollSideways(page, url);
    }
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
