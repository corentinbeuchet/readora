import { Page } from '@playwright/test';
import { test, expect } from './support/fixtures';
import { PAGE_PNG, givenIAmLoggedInAsThePublisher, thenTheFactIs, uniqueSuffix } from './support/helpers';

/** The upload studio end to end: a new series with its facts (US-04), one chapter, then the pages readers get. */
test.describe('Upload studio', () => {
  test('a new series is published with its facts, and its page shows them', async ({ page }) => {
    const title = `E2E Studio ${uniqueSuffix()}`;
    await givenIAmLoggedInAsThePublisher(page);
    await givenIAmInTheUploadStudio(page);

    await whenIDescribeTheSeries(page, { title, otherTitles: 'Studio no Hon\nThe Studio Book', artist: 'Studio Artist', year: '2021', language: 'Japanese' });
    await whenIGoOnTo(page, 'Next: Chapter Setup');
    await whenIGoOnTo(page, 'Next: Upload Pages');
    await whenIAddThePage(page, '001.png');
    await whenIGoOnTo(page, 'Next: Review');
    await whenIPublish(page);
    await whenIViewTheSeriesInTheCatalog(page);

    await thenTheSeriesIs(page, title);
    await thenTheFactIs(page, 'Other titles', ['Studio no Hon', 'The Studio Book']);
    await thenTheFactIs(page, 'Artist', ['Studio Artist']);
    await thenTheFactIs(page, 'First published', ['2021']);
    await thenTheFactIs(page, 'Original language', ['Japanese']);
    await thenTheChapterIsListed(page, 1);
  });

  test('a year that is not a year keeps the series step from going on', async ({ page }) => {
    await givenIAmLoggedInAsThePublisher(page);
    await givenIAmInTheUploadStudio(page);

    await whenIDescribeTheSeries(page, { title: `E2E Studio ${uniqueSuffix()}`, year: '21' });

    await thenICannotGoOnTo(page, 'Next: Chapter Setup');
    await thenTheFieldIsRefusedWith(page, 'First published (year)', 'Enter a year between 1900 and 2100, or leave it empty');
  });
});

async function givenIAmInTheUploadStudio(page: Page): Promise<void> {
  await page.goto('/upload');
  await expect(page.getByRole('heading', { name: '1. Manga / Series Information' })).toBeVisible();
}

async function whenIDescribeTheSeries(page: Page, series: { title: string; otherTitles?: string; artist?: string; year?: string; language?: string }): Promise<void> {
  await page.getByLabel('Series Title').fill(series.title);
  await page.getByLabel('Other titles').fill(series.otherTitles ?? '');
  await page.getByLabel('Artist').fill(series.artist ?? '');
  await page.getByLabel('First published (year)').fill(series.year ?? '');
  await page.getByLabel('Original language').selectOption({ label: series.language ?? 'Not specified' });
  await page.getByLabel('Artist').blur();
}

async function whenIGoOnTo(page: Page, step: string): Promise<void> {
  await page.getByRole('button', { name: step }).click();
}

/** The drop zone opens the file chooser: the same path as a reader choosing files, without a hidden-input selector. */
async function whenIAddThePage(page: Page, name: string): Promise<void> {
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Upload chapter pages or archive' }).click();
  await (await chooser).setFiles({ name, mimeType: 'image/png', buffer: PAGE_PNG });
  await expect(page.getByRole('button', { name: 'Next: Review' })).toBeEnabled();
}

async function whenIPublish(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Publish Series & Chapter' }).click();
  await expect(page.getByRole('heading', { name: 'Series & Chapter Uploaded Successfully!' })).toBeVisible({ timeout: 20000 });
}

async function whenIViewTheSeriesInTheCatalog(page: Page): Promise<void> {
  await page.getByRole('link', { name: 'View in Catalog' }).click();
}

async function thenTheSeriesIs(page: Page, title: string): Promise<void> {
  await expect(page.getByRole('heading', { level: 1 })).toContainText(title);
}

async function thenTheChapterIsListed(page: Page, chapterNumber: number): Promise<void> {
  await expect(page.getByRole('link', { name: new RegExp(`^Ch\\. ${chapterNumber}\\b`) })).toBeVisible();
}

async function thenICannotGoOnTo(page: Page, step: string): Promise<void> {
  await expect(page.getByRole('button', { name: step })).toBeDisabled();
}

async function thenTheFieldIsRefusedWith(page: Page, label: string, message: string): Promise<void> {
  await expect(page.getByLabel(label)).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByText(message)).toBeVisible();
}
