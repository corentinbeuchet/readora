import { Page } from '@playwright/test';
import { test, expect } from './support/fixtures';
import { givenIAmLoggedInAsThePublisher, thenTheFactIs } from './support/helpers';

/**
 * US-04: what a series page says beside the synopsis, and the team leaders who keep it right. The facts shown on the
 * page and a leader's edit are scenarios of US-04 (`@e2e`); this spec keeps the rest.
 */
test.describe('Series facts', () => {
  test('a leader of the team corrects the facts, and readers see them on the series page', async ({ page, seriesWithFacts }) => {
    await givenIAmLoggedInAsThePublisher(page);
    await givenIEditTheSeries(page, seriesWithFacts);

    await whenIFillIn(page, 'Artist', 'Corrected Artist');
    await whenIFillIn(page, 'Other titles', 'Only This Title');
    await whenIChoose(page, 'Content rating', 'Teen (13+)');
    await whenISaveTheSeries(page);

    await thenIAmOnTheSeriesPage(page, seriesWithFacts);
    await thenTheFactIs(page, 'Artist', ['Corrected Artist']);
    await thenTheFactIs(page, 'Other titles', ['Only This Title']);
    await thenTheFactIs(page, 'Content rating', ['Teen (13+)']);
    await thenTheFactIs(page, 'First published', ['2019']);
  });

  test('a year that is not a year is refused in the form', async ({ page, seriesWithFacts }) => {
    await givenIAmLoggedInAsThePublisher(page);
    await givenIEditTheSeries(page, seriesWithFacts);

    await whenIFillIn(page, 'First published (year)', '19');
    await whenISaveTheSeries(page);

    await thenTheFieldIsRefusedWith(page, 'First published (year)', 'Enter a year between 1900 and 2100, or leave it empty');
  });

  test('the search box finds a series by one of its other titles', async ({ page, seriesWithFacts }) => {
    await givenIAmOnTheHomePage(page);

    await whenISearchFor(page, seriesWithFacts.otherTitles[0].toLowerCase());
    await whenIChooseTheSuggestion(page, seriesWithFacts.title);

    await thenIAmOnTheSeriesPage(page, seriesWithFacts);
  });

  test('the catalog finds a series by one of its other titles', async ({ page, seriesWithFacts }) => {
    await whenIOpenTheCatalogSearchingFor(page, seriesWithFacts.otherTitles[0]);

    await thenTheCatalogListsOnly(page, seriesWithFacts.title);
  });

  test('a reader cannot open the edit page of a series', async ({ page, seriesWithFacts }) => {
    await whenIVisitTheEditPageOf(page, seriesWithFacts);

    await thenIAmAskedToLogIn(page);
  });
});

async function givenIEditTheSeries(page: Page, series: { workId: string }): Promise<void> {
  await page.goto(`/scanlation/series/${series.workId}`);
  await expect(page.getByRole('heading', { level: 1, name: 'Edit series' })).toBeVisible();
  await expect(page.getByLabel('Artist')).toHaveValue('E2E Artist');
}

async function givenIAmOnTheHomePage(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
}

async function whenISearchFor(page: Page, text: string): Promise<void> {
  await page.getByRole('combobox', { name: 'Search series by title or author' }).fill(text);
}

async function whenIChooseTheSuggestion(page: Page, title: string): Promise<void> {
  await page.getByRole('option', { name: title }).click();
}

async function whenIOpenTheCatalogSearchingFor(page: Page, text: string): Promise<void> {
  await page.goto(`/works?q=${encodeURIComponent(text)}`);
  await expect(page.getByRole('heading', { level: 1, name: 'Catalog' })).toBeVisible();
}

async function thenTheCatalogListsOnly(page: Page, title: string): Promise<void> {
  await expect(page.getByRole('main').getByRole('link', { name: /^E2E Series / })).toHaveText([title]);
}

async function whenIVisitTheEditPageOf(page: Page, series: { workId: string }): Promise<void> {
  await page.goto(`/scanlation/series/${series.workId}`);
}

async function whenIFillIn(page: Page, label: string, text: string): Promise<void> {
  await page.getByLabel(label).fill(text);
}

async function whenIChoose(page: Page, label: string, option: string): Promise<void> {
  await page.getByLabel(label).selectOption({ label: option });
}

async function whenISaveTheSeries(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Save the series' }).click();
}

async function thenIAmOnTheSeriesPage(page: Page, series: { workId: string; title: string }): Promise<void> {
  await expect(page).toHaveURL(new RegExp(`/works/${series.workId}$`));
  await expect(page.getByRole('heading', { level: 1 })).toContainText(series.title);
}

async function thenTheFieldIsRefusedWith(page: Page, label: string, message: string): Promise<void> {
  await expect(page.getByLabel(label)).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByText(message)).toBeVisible();
}

async function thenIAmAskedToLogIn(page: Page): Promise<void> {
  await expect(page).toHaveURL(/\/login\?returnUrl=/);
}
