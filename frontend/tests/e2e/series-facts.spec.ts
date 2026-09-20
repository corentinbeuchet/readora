import { Page } from '@playwright/test';
import { test, expect } from './support/fixtures';
import { givenIAmLoggedInAsThePublisher } from './support/helpers';

/** US-04: what a series page says beside the synopsis, and the team leaders who keep it right. */
test.describe('Series facts', () => {
  test('the series page lists the facts that were filled in, and only those', async ({ page, seriesWithFacts }) => {
    await whenIOpenTheSeries(page, seriesWithFacts);

    await thenTheFactIs(page, 'Other titles', ['Shin no Nakama', 'The True Companion']);
    await thenTheFactIs(page, 'Artist', ['E2E Artist']);
    await thenTheFactIs(page, 'First published', ['2019']);
    await thenTheFactIs(page, 'Original language', ['Japanese']);
    await thenTheFactIsNotListed(page, 'Content rating');
  });

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

async function whenIOpenTheSeries(page: Page, series: { workId: string; title: string }): Promise<void> {
  await page.goto(`/works/${series.workId}`);
  await expect(page.getByRole('heading', { level: 1 })).toContainText(series.title);
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

/** A fact is a term of the description list with its values: `dt` has the ARIA role "term", `dd` "definition". */
async function thenTheFactIs(page: Page, fact: string, values: string[]): Promise<void> {
  const group = page.locator('dl > div').filter({ has: page.getByRole('term').filter({ hasText: new RegExp(`^${fact}$`) }) });
  await expect(group.getByRole('definition')).toHaveText(values);
}

async function thenTheFactIsNotListed(page: Page, fact: string): Promise<void> {
  await expect(page.getByRole('term').filter({ hasText: new RegExp(`^${fact}$`) })).toHaveCount(0);
}

async function thenTheFieldIsRefusedWith(page: Page, label: string, message: string): Promise<void> {
  await expect(page.getByLabel(label)).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByText(message)).toBeVisible();
}

async function thenIAmAskedToLogIn(page: Page): Promise<void> {
  await expect(page).toHaveURL(/\/login\?returnUrl=/);
}
