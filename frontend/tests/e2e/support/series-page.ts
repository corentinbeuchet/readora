import { Locator, Page, expect } from '@playwright/test';
import { PublishingTeam } from './helpers';

/** The series page and its chapter list (US-12: one row per chapter number, the teams' versions inside). */

export async function whenIOpenTheSeries(page: Page, series: { workId: string; title: string }): Promise<void> {
  await page.goto(`/works/${series.workId}`);
  await expect(page.getByRole('heading', { level: 1 })).toContainText(series.title);
}

export async function whenIOpenTheChapter(page: Page, chapterNumber: number): Promise<void> {
  await chapterLink(page, chapterNumber).click();
}

export async function whenIFilterTheChaptersBy(page: Page, team: PublishingTeam): Promise<void> {
  await page.getByRole('combobox', { name: 'Show chapters by' }).selectOption({ label: team.name });
  await expect(page).toHaveURL(new RegExp(`team=${team.id}`));
}

export async function whenIChooseTheOrder(page: Page, order: string): Promise<void> {
  await page.getByRole('group', { name: 'Order of the chapters' }).getByRole('button', { name: order }).click();
}

export async function thenTheChaptersListedAre(page: Page, chapterNumbers: number[]): Promise<void> {
  await expect(page.getByRole('link', { name: /^Ch\. \d+/ })).toHaveText(chapterNumbers.map((chapterNumber) => new RegExp(`^\\s*Ch\\. ${chapterNumber}\\b`)));
}

export async function thenTheChapterOpensTheVersionBy(page: Page, chapterNumber: number, team: PublishingTeam): Promise<void> {
  await expect(chapterLink(page, chapterNumber)).toHaveAttribute('href', `/read/${team.chapterIds[String(chapterNumber)]}`);
  await expect(chapterLink(page, chapterNumber)).toContainText(`by ${team.name}`);
}

export async function thenTheChapterAlsoOffersTheVersionBy(page: Page, chapterNumber: number, team: PublishingTeam): Promise<void> {
  await expect(page.getByRole('link', { name: `Read chapter ${chapterNumber} by ${team.name}` })).toHaveAttribute('href', `/read/${team.chapterIds[String(chapterNumber)]}`);
}

export async function thenTheChapterIsListedOnce(page: Page, chapterNumber: number): Promise<void> {
  await expect(chapterLink(page, chapterNumber)).toHaveCount(1);
}

/** `chapters`: the count as the page writes it ("1 chapter", "2 chapters"). */
export async function thenTheSeriesIsTranslatedBy(page: Page, team: PublishingTeam, chapters: string): Promise<void> {
  const entry = page.getByRole('region', { name: 'Translated by' }).getByRole('listitem').filter({ hasText: team.name });
  await expect(entry.getByRole('link', { name: team.name })).toHaveAttribute('href', `/teams/${team.id}`);
  await expect(entry).toContainText(chapters);
}

export async function thenTheOrderIs(page: Page, order: string): Promise<void> {
  await expect(page.getByRole('button', { name: order })).toHaveAttribute('aria-pressed', 'true');
}

function chapterLink(page: Page, chapterNumber: number): Locator {
  return page.getByRole('link', { name: new RegExp(`^Ch\\. ${chapterNumber}\\b`) });
}
