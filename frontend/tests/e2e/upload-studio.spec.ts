import { Page } from '@playwright/test';
import { test, expect } from './support/fixtures';
import { PAGE_PNG, givenIAmLoggedInAsThePublisher, givenThePublisherLeadsTheE2eTeam, thenTheFactIs, uniqueSuffix } from './support/helpers';

/**
 * The upload studio end to end: it starts by finding the series (US-12); a new series with its facts (US-04), one
 * chapter, then the pages readers get; or a chapter of a series already in the catalog, as the team's version.
 */
test.describe('Upload studio', () => {
  test('a new series is published with its facts, and its page shows them', async ({ page, request }) => {
    const title = `E2E Studio ${uniqueSuffix()}`;
    const team = await givenThePublisherLeadsTheE2eTeam(request);
    await givenIAmLoggedInAsThePublisher(page);
    await givenIAmCreatingANewSeries(page);

    await whenIDescribeTheSeries(page, { team, title, otherTitles: 'Studio no Hon\nThe Studio Book', artist: 'Studio Artist', year: '2021', language: 'Japanese' });
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

  test('a year that is not a year keeps the series step from going on', async ({ page, request }) => {
    const team = await givenThePublisherLeadsTheE2eTeam(request);
    await givenIAmLoggedInAsThePublisher(page);
    await givenIAmCreatingANewSeries(page);

    await whenIDescribeTheSeries(page, { team, title: `E2E Studio ${uniqueSuffix()}`, year: '21' });

    await thenICannotGoOnTo(page, 'Next: Chapter Setup');
    await thenTheFieldIsRefusedWith(page, 'First published (year)', 'Enter a year between 1900 and 2100, or leave it empty');
  });

  test('a team publishes the next chapter of a series found in the catalog', async ({ page, publishedChapter }) => {
    await givenIAmLoggedInAsThePublisher(page);
    await givenIAmInTheUploadStudio(page);

    await whenISearchTheCatalogFor(page, publishedChapter.title);
    await whenIPublishForMyTeamInto(page, publishedChapter.title);
    await thenIAmPublishingInto(page, publishedChapter.title);
    await whenIGoOnTo(page, 'Next: Chapter Setup');
    await whenITypeTheChapterNumber(page, '2');
    await whenIGoOnTo(page, 'Next: Upload Pages');
    await whenIAddThePage(page, '001.png');
    await whenIGoOnTo(page, 'Next: Review');
    await whenIPublishTheChapter(page);
    await whenIViewTheSeriesInTheCatalog(page);

    await thenTheSeriesIs(page, publishedChapter.title);
    await thenTheChapterIsListed(page, 2);
  });

  test('a chapter the team already published cannot be set up again', async ({ page, publishedChapter }) => {
    await givenIAmLoggedInAsThePublisher(page);
    await givenIAmInTheUploadStudio(page);
    await whenISearchTheCatalogFor(page, publishedChapter.title);
    await whenIPublishForMyTeamInto(page, publishedChapter.title);
    await whenIGoOnTo(page, 'Next: Chapter Setup');

    await whenITypeTheChapterNumber(page, '1');

    await thenIAmToldTheTeamAlreadyPublishedIt(page, publishedChapter.title);
    await thenICannotGoOnTo(page, 'Next: Upload Pages');
  });

  test('a title Readora already has is flagged before the series is created', async ({ page, publishedChapter }) => {
    await givenIAmLoggedInAsThePublisher(page);
    await givenIAmCreatingANewSeries(page);

    await whenIDescribeTheSeries(page, { title: publishedChapter.title });

    await thenIAmToldReadoraAlreadyHas(page, publishedChapter.title);
  });
});

async function givenIAmInTheUploadStudio(page: Page): Promise<void> {
  await page.goto('/upload');
  await expect(page.getByRole('heading', { name: 'Which series is the chapter for?' })).toBeVisible();
}

async function givenIAmCreatingANewSeries(page: Page): Promise<void> {
  await givenIAmInTheUploadStudio(page);
  await page.getByRole('button', { name: 'Create a new series' }).click();
  await expect(page.getByRole('heading', { name: '1. Manga / Series Information' })).toBeVisible();
}

async function whenISearchTheCatalogFor(page: Page, text: string): Promise<void> {
  await page.getByRole('searchbox', { name: 'Series title' }).fill(text);
  await page.getByRole('button', { name: 'Search the catalog' }).click();
}

/** The series was created by the publisher account, so it is on one of its teams already. */
async function whenIPublishForMyTeamInto(page: Page, title: string): Promise<void> {
  await page.getByRole('button', { name: new RegExp(`^Publish for .+: ${title}$`) }).click();
}

async function whenITypeTheChapterNumber(page: Page, chapterNumber: string): Promise<void> {
  await page.getByLabel('Chapter Number').fill(chapterNumber);
}

async function whenIPublishTheChapter(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Publish chapter' }).click();
  await expect(page.getByRole('heading', { name: 'Chapter published' })).toBeVisible({ timeout: 20000 });
}

async function thenIAmPublishingInto(page: Page, title: string): Promise<void> {
  await expect(page.getByText(`You are publishing a chapter of ${title} for the team`)).toBeVisible();
}

async function thenIAmToldTheTeamAlreadyPublishedIt(page: Page, title: string): Promise<void> {
  await expect(page.getByRole('status').filter({ hasText: `already published chapter 1 of ${title}. Choose another number.` })).toBeVisible();
}

async function thenIAmToldReadoraAlreadyHas(page: Page, title: string): Promise<void> {
  const warning = page.getByRole('status').filter({ hasText: 'Readora already has a series with a title like this:' });
  await expect(warning.getByRole('listitem')).toHaveText([title]);
}

/** `team`: the team the series is for (left unchosen when the test is only about the title). */
async function whenIDescribeTheSeries(page: Page, series: { team?: string; title: string; otherTitles?: string; artist?: string; year?: string; language?: string }): Promise<void> {
  if (series.team) {
    await page.getByLabel('Translated by').selectOption({ label: series.team });
  }
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
