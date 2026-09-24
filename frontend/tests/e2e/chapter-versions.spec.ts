import { Page } from '@playwright/test';
import { test, expect } from './support/fixtures';
import { PublishingTeam } from './support/helpers';

/** US-12: several teams translate the same series. The fixture's first team published chapters 1 to 3, the second 1 and 2. */
test.describe('A series translated by several teams', () => {
  test('a chapter translated by two teams is one row that offers both versions', async ({ page, seriesByTwoTeams }) => {
    await whenIOpenTheSeries(page, seriesByTwoTeams);

    await thenTheChaptersListedAre(page, [1, 2, 3]);
    await thenTheChapterOpensTheVersionBy(page, 1, seriesByTwoTeams.firstTeam);
    await thenTheChapterAlsoOffersTheVersionBy(page, 1, seriesByTwoTeams.secondTeam);
    await thenTheChapterHasNoOtherVersion(page, 3);
  });

  test('"Translated by" lists each team with its chapters and links to its page', async ({ page, seriesByTwoTeams }) => {
    await whenIOpenTheSeries(page, seriesByTwoTeams);

    await thenTheSeriesIsTranslatedBy(page, seriesByTwoTeams.firstTeam, '3 chapters');
    await thenTheSeriesIsTranslatedBy(page, seriesByTwoTeams.secondTeam, '2 chapters');
  });

  test('filtering by a team lists only its chapters and survives a reload', async ({ page, seriesByTwoTeams }) => {
    await whenIOpenTheSeries(page, seriesByTwoTeams);

    await whenIFilterTheChaptersBy(page, seriesByTwoTeams.secondTeam);

    await thenTheChaptersListedAre(page, [1, 2]);
    await thenTheChapterOpensTheVersionBy(page, 1, seriesByTwoTeams.secondTeam);

    await whenIReloadThePage(page);

    await thenTheChaptersListedAre(page, [1, 2]);
  });

  test('the newest chapters can come first', async ({ page, seriesByTwoTeams }) => {
    await whenIOpenTheSeries(page, seriesByTwoTeams);

    await whenIChooseTheOrder(page, 'Newest first');

    await thenTheChaptersListedAre(page, [3, 2, 1]);
    await thenTheOrderIs(page, 'Newest first');
  });

  test('switching team in the reader keeps that team for the next chapters, and falls back when it has none', async ({ page, seriesByTwoTeams }) => {
    await whenIOpenTheSeries(page, seriesByTwoTeams);
    await whenIOpenTheChapter(page, 1);
    await whenIChooseTheReadingMode(page, 'Vertical');

    await thenIReadTheVersionBy(page, seriesByTwoTeams.firstTeam, '1');

    await whenISwitchToTheVersionBy(page, seriesByTwoTeams.secondTeam);

    await thenIReadTheVersionBy(page, seriesByTwoTeams.secondTeam, '1');

    await whenIGoToTheNextChapter(page);

    await thenIReadTheVersionBy(page, seriesByTwoTeams.secondTeam, '2');

    await whenIGoToTheNextChapter(page);

    await thenIReadTheVersionBy(page, seriesByTwoTeams.firstTeam, '3');

    await whenIOpenTheSeries(page, seriesByTwoTeams);

    await thenTheChapterOpensTheVersionBy(page, 1, seriesByTwoTeams.secondTeam);
    await thenTheChapterAlsoOffersTheVersionBy(page, 1, seriesByTwoTeams.firstTeam);
  });
});

async function whenIOpenTheSeries(page: Page, series: { workId: string; title: string }): Promise<void> {
  await page.goto(`/works/${series.workId}`);
  await expect(page.getByRole('heading', { level: 1 })).toContainText(series.title);
}

async function whenIOpenTheChapter(page: Page, chapterNumber: number): Promise<void> {
  await chapterLink(page, chapterNumber).click();
}

/** A manga opens page by page, where the end of the chapter only shows on the last page: a strip always has it. */
async function whenIChooseTheReadingMode(page: Page, mode: 'Vertical' | 'Paged'): Promise<void> {
  await page.getByRole('button', { name: mode }).click();
  await expect(page.getByRole('button', { name: mode })).toHaveAttribute('aria-pressed', 'true');
}

async function whenIFilterTheChaptersBy(page: Page, team: PublishingTeam): Promise<void> {
  await page.getByRole('combobox', { name: 'Show chapters by' }).selectOption({ label: team.name });
  await expect(page).toHaveURL(new RegExp(`team=${team.id}`));
}

async function whenIChooseTheOrder(page: Page, order: 'Oldest first' | 'Newest first'): Promise<void> {
  await page.getByRole('group', { name: 'Order of the chapters' }).getByRole('button', { name: order }).click();
}

async function whenIReloadThePage(page: Page): Promise<void> {
  await page.reload();
}

async function whenISwitchToTheVersionBy(page: Page, team: PublishingTeam): Promise<void> {
  await page.getByRole('link', { name: `Read this chapter by ${team.name}` }).click();
}

async function whenIGoToTheNextChapter(page: Page): Promise<void> {
  await page.getByRole('link', { name: 'Next chapter' }).click();
}

async function thenTheChaptersListedAre(page: Page, chapterNumbers: number[]): Promise<void> {
  await expect(page.getByRole('link', { name: /^Ch\. \d+/ })).toHaveText(chapterNumbers.map((chapterNumber) => new RegExp(`^\\s*Ch\\. ${chapterNumber}\\b`)));
}

async function thenTheChapterOpensTheVersionBy(page: Page, chapterNumber: number, team: PublishingTeam): Promise<void> {
  await expect(chapterLink(page, chapterNumber)).toHaveAttribute('href', `/read/${team.chapterIds[String(chapterNumber)]}`);
  await expect(chapterLink(page, chapterNumber)).toContainText(`by ${team.name}`);
}

async function thenTheChapterAlsoOffersTheVersionBy(page: Page, chapterNumber: number, team: PublishingTeam): Promise<void> {
  await expect(page.getByRole('link', { name: `Read chapter ${chapterNumber} by ${team.name}` })).toHaveAttribute('href', `/read/${team.chapterIds[String(chapterNumber)]}`);
}

async function thenTheChapterHasNoOtherVersion(page: Page, chapterNumber: number): Promise<void> {
  await expect(page.getByRole('link', { name: new RegExp(`^Read chapter ${chapterNumber} by`) })).toHaveCount(0);
}

async function thenTheSeriesIsTranslatedBy(page: Page, team: PublishingTeam, chapters: string): Promise<void> {
  const entry = page.getByRole('region', { name: 'Translated by' }).getByRole('listitem').filter({ hasText: team.name });
  await expect(entry.getByRole('link', { name: team.name })).toHaveAttribute('href', `/teams/${team.id}`);
  await expect(entry).toContainText(chapters);
}

async function thenTheOrderIs(page: Page, order: 'Oldest first' | 'Newest first'): Promise<void> {
  await expect(page.getByRole('button', { name: order })).toHaveAttribute('aria-pressed', 'true');
}

/** The chapter's page and its team: the address says which version it is, the toolbar names the team. */
async function thenIReadTheVersionBy(page: Page, team: PublishingTeam, chapterNumber: string): Promise<void> {
  await expect(page).toHaveURL(new RegExp(`/read/${team.chapterIds[chapterNumber]}$`));
  await expect(page.getByRole('link', { name: `Translated by ${team.name}` })).toBeVisible();
}

function chapterLink(page: Page, chapterNumber: number) {
  return page.getByRole('link', { name: new RegExp(`^Ch\\. ${chapterNumber}\\b`) });
}
