import { Page, expect } from '@playwright/test';
import { PAGE_PNG } from './helpers';

/** The upload studio (`/upload`, US-12 and US-04): find the series first, or create one, then the chapter and its pages. */

export async function givenIAmInTheUploadStudio(page: Page): Promise<void> {
  await page.goto('/upload');
  await expect(page.getByRole('heading', { name: 'Which series is the chapter for?' })).toBeVisible();
}

export async function givenIAmCreatingANewSeries(page: Page): Promise<void> {
  await givenIAmInTheUploadStudio(page);
  await whenIChooseToCreateANewSeries(page);
}

/** The Studio's "Publish a chapter" link of a series: the studio starts at that series, for that team. */
export async function givenIAmPublishingIntoTheSeriesFor(page: Page, series: { workId: string; title: string }, teamId: string): Promise<void> {
  await page.goto(`/upload?workId=${series.workId}&teamId=${teamId}`);
  await expect(page.getByText(`You are publishing a chapter of ${series.title} for the team`)).toBeVisible();
}

export async function whenIChooseToCreateANewSeries(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Create a new series' }).click();
  await expect(page.getByRole('heading', { name: '1. Manga / Series Information' })).toBeVisible();
}

export async function whenISearchTheCatalogFor(page: Page, text: string): Promise<void> {
  await page.getByRole('searchbox', { name: 'Series title' }).fill(text);
  await page.getByRole('button', { name: 'Search the catalog' }).click();
}

/**
 * "Publish for <team>" when the team works on the series already, "Add to <team> and publish" when it doesn't (the
 * button's name ends with " : <title>").
 */
export async function whenIPublishIntoTheSeriesFor(page: Page, title: string, teamName: string): Promise<void> {
  const result = page.getByRole('listitem').filter({ has: page.getByRole('link', { name: title, exact: true }) });
  await result.getByRole('button', { name: new RegExp(`^(Publish for ${teamName}|Add to ${teamName} and publish) :`) }).click();
  await expect(page.getByText(`You are publishing a chapter of ${title} for the team ${teamName}`)).toBeVisible();
}

export async function whenITypeTheChapterNumber(page: Page, chapterNumber: string): Promise<void> {
  await page.getByLabel('Chapter Number').fill(chapterNumber);
}

/** `team`: the team the series is for (left unchosen when the test is only about the title). */
export async function whenIDescribeTheSeries(page: Page, series: { team?: string; title: string; otherTitles?: string; artist?: string; year?: string; language?: string }): Promise<void> {
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

export async function whenIGoOnTo(page: Page, step: string): Promise<void> {
  await page.getByRole('button', { name: step }).click();
}

/** The drop zone opens the file chooser: the same path as a reader choosing files, without a hidden-input selector. */
export async function whenIAddThePage(page: Page, name: string): Promise<void> {
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Upload chapter pages or archive' }).click();
  await (await chooser).setFiles({ name, mimeType: 'image/png', buffer: PAGE_PNG });
  await expect(page.getByRole('button', { name: 'Next: Review' })).toBeEnabled();
}

export async function whenIPublishTheChapter(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Publish chapter' }).click();
  await expect(page.getByRole('heading', { name: 'Chapter published' })).toBeVisible({ timeout: 20000 });
}

/** From the series step of a series already in the catalog: one page, published straight away. */
export async function whenIPublishChapterWithOnePage(page: Page, chapterNumber: string): Promise<void> {
  await whenIGoOnTo(page, 'Next: Chapter Setup');
  await whenITypeTheChapterNumber(page, chapterNumber);
  await whenIGoOnTo(page, 'Next: Upload Pages');
  await whenIAddThePage(page, '001.png');
  await whenIGoOnTo(page, 'Next: Review');
  await whenIPublishTheChapter(page);
}

export async function thenIAmToldReadoraAlreadyHas(page: Page, title: string): Promise<void> {
  const warning = page.getByRole('status').filter({ hasText: 'Readora already has a series with a title like this:' });
  await expect(warning.getByRole('listitem').filter({ hasText: title })).toHaveText([title]);
}

export async function thenTheChapterIsOutAsTheVersionOf(page: Page, chapterNumber: string, title: string, teamName: string): Promise<void> {
  await expect(page.getByText(`Chapter ${chapterNumber} of ${title} is out, as the version of ${teamName}.`)).toBeVisible();
}
