import { Page } from '@playwright/test';
import { test, expect } from './support/fixtures';
import { givenIAmLoggedInAsThePublisher, givenThePublisherLeadsTheE2eTeam, thenTheFactIs, uniqueSuffix } from './support/helpers';
import {
  givenIAmCreatingANewSeries,
  givenIAmInTheUploadStudio,
  whenIAddThePage,
  whenIDescribeTheSeries,
  whenIGoOnTo,
  whenIPublishIntoTheSeriesFor,
  whenISearchTheCatalogFor,
  whenITypeTheChapterNumber
} from './support/upload-studio';

/**
 * The upload studio end to end: a new series with its facts (US-04), one chapter, then the pages readers get. The
 * US-12 scenarios (finding the series, publishing a team's version, similar titles) run in the browser (`@e2e`).
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

  test('a chapter the team already published cannot be set up again', async ({ page, publishedChapter, request }) => {
    const team = await givenThePublisherLeadsTheE2eTeam(request);
    await givenIAmLoggedInAsThePublisher(page);
    await givenIAmInTheUploadStudio(page);
    await whenISearchTheCatalogFor(page, publishedChapter.title);
    await whenIPublishIntoTheSeriesFor(page, publishedChapter.title, team);
    await whenIGoOnTo(page, 'Next: Chapter Setup');

    await whenITypeTheChapterNumber(page, '1');

    await thenIAmToldTheTeamAlreadyPublishedIt(page, publishedChapter.title);
    await thenICannotGoOnTo(page, 'Next: Upload Pages');
  });
});

async function thenIAmToldTheTeamAlreadyPublishedIt(page: Page, title: string): Promise<void> {
  await expect(page.getByRole('status').filter({ hasText: `already published chapter 1 of ${title}. Choose another number.` })).toBeVisible();
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
