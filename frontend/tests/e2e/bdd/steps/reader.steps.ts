import { APIRequestContext, Locator, Page, expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';
import { test } from '../fixtures';
import { Story } from '../story';
import { logIn, pagesOf, recordARead, saveMyPlace, whenIChooseTheReadingMode } from '../../support/helpers';
import { whenIOpenTheSeries } from '../../support/series-page';

/**
 * US-07 reading experience and US-06 zen mode: the reader page. Chapters are published the first time a step needs
 * them (`Story.chapter`, five one-pixel pages unless the scenario says how many). The browser is the reader's.
 */
const { Given, When, Then } = createBdd(test);

/** The reader's page sizes, as the settings name them and as the page is then drawn. */
const FITS: Record<string, 'WIDTH' | 'HEIGHT' | 'ORIGINAL'> = { 'Fit width': 'WIDTH', 'Fit height': 'HEIGHT', 'Original size': 'ORIGINAL' };
/** The reader backgrounds (`--reader-black|gray|white`). */
const BACKGROUNDS: Record<string, string> = { black: 'rgb(0, 0, 0)', gray: 'rgb(63, 63, 70)', white: 'rgb(255, 255, 255)' };

Given('{string} is signed in', async ({ page, story }, reader: string) => {
  await givenIAmSignedInAs(page, story, reader);
});

Given('the catalog has the manhwa {string} and the manga {string}', async ({ story }, manhwa: string, manga: string) => {
  await story.series(manhwa, { type: 'MANHWA' });
  await story.series(manga, { type: 'MANGA' });
});

Given('reader {string} is reading chapter {int} of {string}, translated by the team {string}', async ({ page, story }, reader: string, chapter: number, series: string, team: string) => {
  await givenTheTeamPublished(story, team, series, chapter);
  await page.clock.install();
  await givenIAmSignedInAs(page, story, reader);
  await whenIOpenTheChapter(page, await story.chapter(series, chapter));
});

Given('{string} reads {string} in paged mode', async ({ page, story }, _reader: string, series: string) => {
  await whenIOpenTheChapter(page, await story.chapter(series, 1));
  await whenIChooseTheReadingMode(page, 'Paged');
});

Given('{string} switched {string} to vertical mode', async ({ page, story }, _reader: string, series: string) => {
  await whenIOpenTheChapter(page, await story.chapter(series, 1));
  await whenIChooseTheReadingMode(page, 'Vertical');
});

Given('{string} reads a chapter in paged mode', async ({ page, story }, _reader: string) => {
  await whenIOpenTheChapter(page, await story.chapter('Solo Leveling', 1));
  await whenIChooseTheReadingMode(page, 'Paged');
  await givenMyFocusIsOnThePage(page);
});

Given('{string} is on page {int} of a chapter', async ({ page, story }, _reader: string, pageNumber: number) => {
  story.remember('chapter', await story.chapter('Solo Leveling', 1));
  await whenIOpenTheChapter(page, story.recall('chapter'));
  await whenIChooseTheReadingMode(page, 'Paged');
  await whenIGoToPage(page, pageNumber);
});

Given('{string} finished every published chapter of {string}', async ({ request, story }, reader: string, series: string) => {
  await givenIFinished(request, story, reader, series, [1, 2]);
});

Given('{string} has chapters {chapters}', async ({ story }, series: string, chapters: number[]) => {
  await givenTheSeriesHasChapters(story, series, chapters);
});

Given("{string}'s saved page is in chapter {int} of {string}", async ({ request, story }, reader: string, chapter: number, series: string) => {
  story.remember('series', series);
  await saveMyPlace(request, story.account(reader), (await story.series(series)).workId, await story.chapter(series, chapter), 2);
});

Given('he finished chapters {chapters}', async ({ request, story }, chapters: number[]) => {
  await givenIFinished(request, story, story.actorNamed(), story.recall('series'), chapters);
});

Given('{string} is on page {int} of {int}', async ({ page, story }, _reader: string, pageNumber: number, pageCount: number) => {
  await whenIOpenTheChapter(page, await story.chapter('Solo Leveling', 1, { count: pageCount }));
  await whenIChooseTheReadingMode(page, 'Paged');
  await whenIGoToPage(page, pageNumber);
});

Given('{string} reads {string} on a wide screen', async ({ page, story }, _reader: string, series: string) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await whenIOpenTheChapter(page, await story.chapter(series, 1));
});

Given('{string} reads {string} in vertical mode', async ({ page, story }, _reader: string, series: string) => {
  await whenIOpenTheChapter(page, await story.chapter(series, 1, { count: 10 }));
  await thenTheReadingModeIs(page, 'Vertical');
});

Given("Kenji's browser asks sites to save data", async ({ page, story }) => {
  await givenAChapterWithDataSaverCopies(story);
  await givenMyBrowserAsksToSaveData(page);
});

Given('{string} never turned {string} on or off', async ({ page }, _reader: string, _setting: string) => {
  await givenIHaveNoDataSaverChoice(page);
});

Given('{string} is reading chapter {int} of {string}', async ({ page, story }, _reader: string, chapter: number, series: string) => {
  story.remember('series', series);
  await givenTheSeriesHasChapters(story, series, Array.from({ length: chapter }, (_, index) => index + 1));
  await whenIOpenTheChapter(page, await story.chapter(series, chapter));
});

Given('{string} uses a screen reader', async ({ story }, reader: string) => {
  givenIUseAScreenReader(story, reader);
});

Given(
  'she is on page {int} of {int} of a chapter whose uploader described page {int} as {string}',
  async ({ page, story }, pageNumber: number, pageCount: number, described: number, description: string) => {
    story.remember('description', description);
    await whenIOpenTheChapter(page, await story.chapter('Solo Leveling', 1, { count: pageCount, descriptions: { [described]: description } }));
    await whenIChooseTheReadingMode(page, 'Paged');
    await whenIGoToPage(page, pageNumber);
  }
);

When('he chooses {string}', async ({ page }, direction: string) => {
  await whenIChooseTheDirection(page, direction);
});

When('{string} opens a chapter of the manhwa {string}', async ({ page, story }, _reader: string, series: string) => {
  await whenIOpenTheChapter(page, await story.chapter(series, 1));
});

When('he opens a chapter of the manga {string}', async ({ page, story }, series: string) => {
  await whenIOpenTheChapter(page, await story.chapter(series, 1));
});

When('he opens another chapter of {string}', async ({ page, story }, series: string) => {
  await whenIOpenTheChapter(page, await story.chapter(series, 2));
});

When('he presses the right arrow, Space or Page Down', async ({ page }) => {
  await whenIPress(page, ['ArrowRight', 'Space', 'PageDown']);
});

When('{string} chooses {string}, {string} or {string}', async ({ page, story }, _reader: string, first: string, second: string, third: string) => {
  story.remember('fits', JSON.stringify([first, second, third]));
  await whenIOpenTheChapter(page, await story.chapter('One Piece', 1));
});

When('he opens the page of {string}', async ({ page, story }, series: string) => {
  await whenIOpenTheSeries(page, await story.series(series));
});

When('he clicks the end of the bar', async ({ page }) => {
  await whenIClickTheEndOfTheProgressBar(page);
});

When('he turns on {string}', async ({ page }, setting: string) => {
  await whenITurnOnTheSetting(page, setting);
});

When('he turns on auto-scroll at {word} speed', async ({ page }, speed: string) => {
  await whenIChooseTheSetting(page, 'Auto-scroll speed', capitalized(speed));
  await whenIToggleAutoScroll(page);
});

When('{string} picks a black, gray or white background', async ({ page, story }, _reader: string) => {
  await whenIOpenTheChapter(page, await story.chapter('Solo Leveling', 1));
});

When('{string} turns off {string}', async ({ page }, _reader: string, setting: string) => {
  await whenITurnOffTheSetting(page, setting);
});

When('he opens the chapter list from the reader', async ({ page }) => {
  await whenIOpenTheReaderChapterList(page);
});

When('she turns a page', async ({ page }) => {
  await whenIPress(page, ['ArrowRight']);
});

When('{string} turns on zen mode', async ({ page }, _reader: string) => {
  await whenIToggleZenMode(page);
});

When('he moves the mouse or taps the screen', async ({ page }) => {
  await whenIMoveTheMouse(page);
});

When('he presses Escape', async ({ page }) => {
  await whenIPress(page, ['Escape']);
});

Then('the {string} arrow and swipe direction go to the left', async ({ page }, next: string) => {
  await thenTheButtonIsLeftOf(page, next, 'Prev');
  await thenSwipingTowardsTurnsTo(page, 'right', 2);
});

Then('the page order follows the Japanese reading direction', async ({ page }) => {
  await thenClickingTheThirdTurnsTo(page, 'left', 3);
});

Then('it opens in vertical mode', async ({ page }) => {
  await thenTheReadingModeIs(page, 'Vertical');
});

Then('it opens in paged right-to-left mode', async ({ page }) => {
  await thenTheReadingModeIs(page, 'Paged');
  await thenTheDirectionIs(page, 'Right to left');
});

Then('{string} keeps its own mode', async ({ page, story }, series: string) => {
  await whenIOpenTheChapter(page, await story.chapter(series, 1));
  await thenTheReadingModeIs(page, 'Vertical');
});

Then('the next page is shown', async ({ page }) => {
  await thenIReadPage(page, 4);
});

Then('clicking the left or right third of the page also turns it', async ({ page }) => {
  await thenClickingTheThirdTurnsTo(page, 'right', 5);
  await thenClickingTheThirdTurnsTo(page, 'left', 4);
});

Then('pages {int} and {int} are already loaded', async ({ page, request, story }, first: number, second: number) => {
  await thenThePagesWereDownloaded(page, await pageUrls(request, story.recall('chapter'), [first, second]));
});

Then('turning the page shows the next image without waiting', async ({ page, request, story }) => {
  await whenIPress(page, ['ArrowRight']);
  await thenIReadPage(page, 4);
  await thenThePageImageWasDownloadedOnce(page, (await pageUrls(request, story.recall('chapter'), [4]))[0]);
});

Then('the page is resized that way', async ({ page, story }) => {
  await thenEachPageSizeIsDrawnThatWay(page, JSON.parse(story.recall('fits')) as string[]);
});

Then('the choice is kept for his next chapters', async ({ page, story }) => {
  await whenIOpenTheChapter(page, await story.chapter('One Piece', 2));
  await thenThePageIsDrawn(page, FITS[lastOf(JSON.parse(story.recall('fits')) as string[])]);
});

Then('he is told he is up to date', async ({ page }) => {
  await thenIAmToldIAmUpToDate(page);
});

Then('the main button is {string}, which opens chapter {int}', async ({ page, story }, button: string, chapter: number) => {
  await thenTheMainButtonOpens(page, button, await story.chapter(story.recall('series'), chapter));
});

Then('the main button is {string}', async ({ page }, button: string) => {
  await thenThereIsTheMainButton(page, button);
});

Then('a thin progress bar shows he is {int}% through the chapter', async ({ page }, percent: number) => {
  await thenTheProgressIs(page, `${percent}%`);
});

Then('page {int} is shown', async ({ page }, pageNumber: number) => {
  await thenIReadPage(page, pageNumber);
});

When('he turns the page', async ({ page }) => {
  await whenITurnThePage(page);
});

Then('two pages are shown side by side like a printed book', async ({ page }) => {
  await thenThePagesAreSideBySideInReadingOrder(page, 3, 2);
});

Then('the chapter scrolls slowly on its own', async ({ page }) => {
  await thenThePageScrollsOnItsOwn(page);
});

Then('it stops as soon as he touches or scrolls the page', async ({ page }) => {
  await whenIScrollThePage(page);
  await thenAutoScrollIsOff(page);
});

Then('the space around the pages uses that colour', async ({ page }) => {
  await thenEachBackgroundColoursTheSpaceAroundThePage(page);
});

Then('chapters load lighter, lower-quality images', async ({ page, request, story }) => {
  await whenIOpenTheChapter(page, story.recall('chapter'));
  await thenPageOneComesFrom(page, (await pageOne(request, story.recall('chapter'))).liteCdnUrl!);
});

Then('chapters load the full images, even though the browser still asks to save data', async ({ page, request, story }) => {
  await thenPageOneComesFrom(page, (await pageOne(request, story.recall('chapter'))).cdnUrl);
});

Then('he sees every chapter with the ones he read marked', async ({ page, story }) => {
  await thenTheReaderChapterListIs(page, story.chapterNumbers(story.recall('series')));
  await thenTheChaptersMarkedReadAre(page, [1, 2]);
});

Then('choosing chapter {int} opens it without leaving the reader', async ({ page, story }, chapter: number) => {
  await whenIChooseInTheReaderChapterList(page, chapter);
  await thenIAmReadingTheChapter(page, await story.chapter(story.recall('series'), chapter));
});

Then('she hears {string}', async ({ page }, announcement: string) => {
  await thenTheLiveRegionSays(page, announcement);
});

Then('she hears the page description the uploader wrote', async ({ page, story }) => {
  await thenThePageIsNamed(page, `Page 3: ${story.recall('description')}`);
});

Then('the site header and the reader toolbar are hidden', async ({ page }) => {
  await thenTheSiteHeaderIsHidden(page);
  await thenTheReaderToolbarIs(page, 'hidden');
});

Then('the reader toolbar comes back and hides again after 3 seconds', async ({ page }) => {
  await thenTheReaderToolbarIs(page, 'shown');
  await whenTimePasses(page, 3000);
  await thenTheReaderToolbarIs(page, 'hidden');
});

Then('zen mode is off', async ({ page }) => {
  await thenZenModeIsOff(page);
  await thenTheSiteHeaderIsShown(page);
});

/** Nothing to install: a screen reader reads the page's accessible text, which the steps check. */
function givenIUseAScreenReader(story: Story, reader: string): void {
  story.follow(reader);
}

/**
 * The reader has left the toolbar: keys go to the page. (On the button just pressed, the arrows would move along the
 * toolbar and Space would press it again, as a toolbar should.)
 */
async function givenMyFocusIsOnThePage(page: Page): Promise<void> {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
}

async function givenTheSeriesHasChapters(story: Story, series: string, chapters: number[]): Promise<void> {
  for (const chapter of chapters) {
    await story.chapter(series, chapter);
  }
}

async function givenIAmSignedInAs(page: Page, story: Story, reader: string): Promise<void> {
  await story.newReader(reader);
  story.follow(reader);
  await logIn(page, story.account(reader));
}

async function givenTheTeamPublished(story: Story, team: string, series: string, chapter: number): Promise<void> {
  await story.publishingTeam(team);
  await story.publish(team, series, [chapter], { count: 5, fullSize: true });
}

async function givenIFinished(request: APIRequestContext, story: Story, reader: string, series: string, chapters: number[]): Promise<void> {
  story.remember('series', series);
  for (const chapter of chapters) {
    await recordARead(request, { ...story.account(reader), username: story.account(reader).username!, accessToken: story.account(reader).accessToken! }, await story.chapter(series, chapter), true);
  }
}

/** A chapter whose pages have their lighter data-saver copies. */
async function givenAChapterWithDataSaverCopies(story: Story): Promise<void> {
  story.remember('chapter', await story.chapter('Solo Leveling', 1, { count: 2, withLiteCopies: true }));
}

/** Uses the Network Information API as a browser in data-saving mode exposes it (before the app starts). */
async function givenMyBrowserAsksToSaveData(page: Page): Promise<void> {
  await page.addInitScript(() => Object.defineProperty(navigator, 'connection', { value: { saveData: true }, configurable: true }));
}

/** The reader settings kept in the browser hold no data-saver choice. */
async function givenIHaveNoDataSaverChoice(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const key = 'readora.reader.preferences';
    const stored = JSON.parse(localStorage.getItem(key) ?? '{}') as Record<string, unknown>;
    delete stored['dataSaver'];
    localStorage.setItem(key, JSON.stringify(stored));
  });
}

async function whenIOpenTheChapter(page: Page, chapterId: string): Promise<void> {
  await page.goto(`/read/${chapterId}`);
  await expect(page.getByRole('toolbar', { name: 'Reader controls' })).toBeVisible();
}

async function whenIChooseTheDirection(page: Page, direction: string): Promise<void> {
  await page.getByRole('button', { name: direction }).click();
}

async function whenIGoToPage(page: Page, pageNumber: number): Promise<void> {
  await page.getByLabel('Go to page').fill(String(pageNumber));
  await thenIReadPage(page, pageNumber);
}

async function whenIPress(page: Page, keys: string[]): Promise<void> {
  for (const key of keys) {
    await page.keyboard.press(key);
  }
}

async function whenIOpenTheSettings(page: Page): Promise<void> {
  const button = page.getByRole('button', { name: 'Settings' });
  if ((await button.getAttribute('aria-expanded')) !== 'true') {
    await button.click();
  }
}

async function whenIChooseTheSetting(page: Page, setting: string, option: string): Promise<void> {
  await whenIOpenTheSettings(page);
  await page.getByRole('region', { name: 'Reader settings' }).getByLabel(setting).selectOption({ label: option });
}

async function whenITurnOnTheSetting(page: Page, setting: string): Promise<void> {
  await whenIOpenTheSettings(page);
  await page.getByRole('region', { name: 'Reader settings' }).getByRole('checkbox', { name: setting }).check();
}

async function whenITurnOffTheSetting(page: Page, setting: string): Promise<void> {
  await whenIOpenTheSettings(page);
  await page.getByRole('region', { name: 'Reader settings' }).getByRole('checkbox', { name: setting }).uncheck();
}

async function whenIToggleAutoScroll(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Auto-scroll' }).click();
}

async function whenITurnThePage(page: Page): Promise<void> {
  await page.getByRole('navigation', { name: 'Page navigation' }).getByRole('button', { name: /Next/ }).click();
}

async function whenIClickTheEndOfTheProgressBar(page: Page): Promise<void> {
  const box = (await page.getByLabel('Go to page').boundingBox())!;
  await page.mouse.click(box.x + box.width - 2, box.y + box.height / 2);
}

async function whenIMoveTheMouse(page: Page): Promise<void> {
  await page.mouse.move(200, 300);
  await page.mouse.move(220, 320);
}

async function whenIToggleZenMode(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Zen mode' }).click();
}

async function whenIOpenTheReaderChapterList(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Chapters' }).click();
}

async function whenIChooseInTheReaderChapterList(page: Page, chapter: number): Promise<void> {
  await page.getByRole('region', { name: 'Chapters' }).getByRole('link', { name: new RegExp(`^Ch\\. ${chapter}(?!\\d)`) }).click();
}

async function whenIScrollThePage(page: Page): Promise<void> {
  await page.mouse.wheel(0, 40);
}

/** The page's clock (installed before it loaded) jumps ahead instead of waiting. */
async function whenTimePasses(page: Page, milliseconds: number): Promise<void> {
  await page.clock.runFor(milliseconds);
}

function pageImage(page: Page, pageNumber: number): Locator {
  return page.getByRole('img', { name: new RegExp(`^Page ${pageNumber}(?!\\d)`) });
}

async function thenIReadPage(page: Page, pageNumber: number): Promise<void> {
  await expect(pageImage(page, pageNumber)).toBeVisible();
}

async function thenTheReadingModeIs(page: Page, mode: 'Vertical' | 'Paged'): Promise<void> {
  await expect(page.getByRole('button', { name: mode, exact: true })).toHaveAttribute('aria-pressed', 'true');
}

async function thenTheDirectionIs(page: Page, direction: string): Promise<void> {
  await expect(page.getByRole('button', { name: direction })).toHaveAttribute('aria-pressed', 'true');
}

async function thenTheButtonIsLeftOf(page: Page, left: string, right: string): Promise<void> {
  const navigation = page.getByRole('navigation', { name: 'Page navigation' });
  const leftBox = (await navigation.getByRole('button', { name: new RegExp(left) }).boundingBox())!;
  const rightBox = (await navigation.getByRole('button', { name: new RegExp(right) }).boundingBox())!;
  expect(leftBox.x).toBeLessThan(rightBox.x);
}

/**
 * A finger's swipe drags the page: towards the right brings the page on the left. Sent as touch pointer events (a
 * mouse drag would start dragging the image, which a finger does not).
 */
async function thenSwipingTowardsTurnsTo(page: Page, towards: 'left' | 'right', pageNumber: number): Promise<void> {
  const image = page.getByRole('img', { name: /^Page \d+/ });
  const area = await visiblePartOf(page, image);
  const [from, to] = towards === 'right' ? [area.left + 10, area.right - 10] : [area.right - 10, area.left + 10];
  await image.dispatchEvent('pointerdown', { clientX: from, clientY: area.middle, pointerType: 'touch', bubbles: true });
  await image.dispatchEvent('pointerup', { clientX: to, clientY: area.middle, pointerType: 'touch', bubbles: true });
  await thenIReadPage(page, pageNumber);
}

/** The left and right thirds of the page are click zones (mouse only: the buttons are the accessible way). */
async function thenClickingTheThirdTurnsTo(page: Page, third: 'left' | 'right', pageNumber: number): Promise<void> {
  const area = await visiblePartOf(page, page.getByRole('img', { name: /^Page \d+/ }));
  const width = area.right - area.left;
  await page.mouse.click(third === 'left' ? area.left + width / 6 : area.left + (width * 5) / 6, area.middle);
  await thenIReadPage(page, pageNumber);
}

/** The part of a (tall) page on screen, where a hand or a mouse can reach it. */
async function visiblePartOf(page: Page, image: Locator): Promise<{ left: number; right: number; middle: number }> {
  await image.scrollIntoViewIfNeeded();
  const box = (await image.boundingBox())!;
  const top = Math.max(box.y, 0);
  const bottom = Math.min(box.y + box.height, page.viewportSize()!.height);
  return { left: box.x, right: box.x + box.width, middle: (top + bottom) / 2 };
}

/** The browser fetched these images already (Resource Timing), before the reader turned to them. */
async function thenThePagesWereDownloaded(page: Page, urls: string[]): Promise<void> {
  await expect.poll(() => page.evaluate((names) => names.every((name) => performance.getEntriesByName(name).length > 0), urls)).toBe(true);
}

/** Shown from what was preloaded: once the page's image is loaded, it was fetched only once (by the preload). */
async function thenThePageImageWasDownloadedOnce(page: Page, url: string): Promise<void> {
  await expect
    .poll(() =>
      page.evaluate((name) => {
        const image = [...document.images].find((img) => img.currentSrc === name && img.alt);
        return { loaded: image?.complete ?? false, downloads: performance.getEntriesByName(name).length };
      }, url)
    )
    .toEqual({ loaded: true, downloads: 1 });
}

/** Fit width fills the page's column, fit height the screen's height (less 2rem), original size is the image's own. */
async function thenThePageIsDrawn(page: Page, fit: 'WIDTH' | 'HEIGHT' | 'ORIGINAL'): Promise<void> {
  const image = page.getByRole('img', { name: /^Page \d+/ });
  await expect
    .poll(() =>
      image.evaluate((img: HTMLImageElement, mode) => {
        const drawn = img.getBoundingClientRect();
        if (mode === 'WIDTH') return Math.abs(drawn.width - img.parentElement!.getBoundingClientRect().width) <= 1;
        if (mode === 'HEIGHT') return Math.abs(drawn.height - (window.innerHeight - 32)) <= 1;
        return Math.abs(drawn.width - img.naturalWidth) <= 1;
      }, fit)
    )
    .toBe(true);
}

async function thenEachPageSizeIsDrawnThatWay(page: Page, fits: string[]): Promise<void> {
  for (const fit of fits) {
    await whenIChooseTheSetting(page, 'Page size', fit);
    await thenThePageIsDrawn(page, FITS[fit]);
  }
}

async function thenIAmToldIAmUpToDate(page: Page): Promise<void> {
  await expect(page.getByText("You're up to date: you read every chapter.")).toBeVisible();
}

/** What a screen reader announces: the live region's text (it is visually hidden). */
async function thenTheLiveRegionSays(page: Page, announcement: string): Promise<void> {
  await expect(page.getByText(announcement, { exact: true })).toBeAttached();
}

async function thenThePageIsNamed(page: Page, name: string): Promise<void> {
  await expect(page.getByRole('img', { name })).toBeVisible();
}

async function thenZenModeIsOff(page: Page): Promise<void> {
  await expect(page.getByRole('button', { name: 'Zen mode' })).toHaveAttribute('aria-pressed', 'false');
}

async function thenTheSiteHeaderIsShown(page: Page): Promise<void> {
  await expect(page.getByRole('banner')).toBeVisible();
}

async function thenTheMainButtonOpens(page: Page, name: string, chapterId: string): Promise<void> {
  await expect(page.getByRole('link', { name, exact: true })).toHaveAttribute('href', `/read/${chapterId}`);
}

async function thenThereIsTheMainButton(page: Page, name: string): Promise<void> {
  await expect(page.getByRole('link', { name, exact: true })).toBeVisible();
}

async function thenTheProgressIs(page: Page, percent: string): Promise<void> {
  await expect(page.getByText(percent, { exact: true })).toBeVisible();
}

/** A spread: both pages on one line, `left` on the left (in a manga read right to left, the later page). */
async function thenThePagesAreSideBySideInReadingOrder(page: Page, left: number, right: number): Promise<void> {
  await expect(pageImage(page, left)).toBeVisible();
  await expect(pageImage(page, right)).toBeVisible();
  const [a, b] = [(await pageImage(page, left).boundingBox())!, (await pageImage(page, right).boundingBox())!];
  expect(Math.abs(a.y - b.y)).toBeLessThanOrEqual(1);
  expect(a.x + a.width).toBeLessThanOrEqual(b.x + 1);
}

async function thenThePageScrollsOnItsOwn(page: Page): Promise<void> {
  const start = await page.evaluate(() => window.scrollY);
  await expect.poll(() => page.evaluate(() => window.scrollY), { timeout: 5000 }).toBeGreaterThan(start + 20);
}

async function thenAutoScrollIsOff(page: Page): Promise<void> {
  await expect(page.getByRole('button', { name: 'Auto-scroll' })).toHaveAttribute('aria-pressed', 'false');
}

/** The first colour behind the page, going out from it: what the reader sees around the pages. */
async function thenTheSpaceAroundThePageIs(page: Page, colour: string): Promise<void> {
  const image = page.getByRole('img', { name: /^Page 1(?!\d)/ });
  await expect
    .poll(() =>
      image.evaluate((img) => {
        for (let node = img.parentElement; node; node = node.parentElement) {
          const background = getComputedStyle(node).backgroundColor;
          if (background !== 'rgba(0, 0, 0, 0)' && background !== 'transparent') return background;
        }
        return null;
      })
    )
    .toBe(colour);
}

async function thenEachBackgroundColoursTheSpaceAroundThePage(page: Page): Promise<void> {
  for (const [name, colour] of Object.entries(BACKGROUNDS)) {
    await whenIChooseTheSetting(page, 'Background', capitalized(name));
    await thenTheSpaceAroundThePageIs(page, colour);
  }
}

async function thenPageOneComesFrom(page: Page, url: string): Promise<void> {
  await expect(pageImage(page, 1)).toHaveAttribute('src', url);
}

async function thenTheReaderChapterListIs(page: Page, chapters: number[]): Promise<void> {
  await expect(page.getByRole('region', { name: 'Chapters' }).getByRole('link')).toHaveText(chapters.map((chapter) => new RegExp(`^\\s*Ch\\. ${chapter}(?!\\d)`)));
}

async function thenTheChaptersMarkedReadAre(page: Page, chapters: number[]): Promise<void> {
  await expect(page.getByRole('region', { name: 'Chapters' }).getByRole('link').filter({ hasText: /Read$/ })).toHaveText(
    chapters.map((chapter) => new RegExp(`^\\s*Ch\\. ${chapter}(?!\\d)`))
  );
}

async function thenIAmReadingTheChapter(page: Page, chapterId: string): Promise<void> {
  await expect(page).toHaveURL(new RegExp(`/read/${chapterId}$`));
  await expect(page.getByRole('toolbar', { name: 'Reader controls' })).toBeVisible();
}

async function thenTheSiteHeaderIsHidden(page: Page): Promise<void> {
  await expect(page.getByRole('banner')).toBeHidden();
}

/** Hidden controls fade out (opacity) but stay in the page, so a keyboard user can still reach them. */
async function thenTheReaderToolbarIs(page: Page, state: 'shown' | 'hidden'): Promise<void> {
  const toolbar = page.getByRole('toolbar', { name: 'Reader controls' });
  await expect
    .poll(() =>
      toolbar.evaluate((element) => {
        let opacity = 1;
        for (let node: Element | null = element; node; node = node.parentElement) {
          opacity *= Number(getComputedStyle(node).opacity);
        }
        return opacity;
      })
    )
    .toBe(state === 'shown' ? 1 : 0);
}

/** The image addresses of these pages of the chapter, as readers get them. */
async function pageUrls(request: APIRequestContext, chapterId: string, pageNumbers: number[]): Promise<string[]> {
  const pages = await pagesOf(request, chapterId);
  return pageNumbers.map((pageNumber) => pages.find((candidate) => candidate.pageNumber === pageNumber)!.cdnUrl);
}

async function pageOne(request: APIRequestContext, chapterId: string): Promise<{ cdnUrl: string; liteCdnUrl: string | null }> {
  return (await pagesOf(request, chapterId)).find((candidate) => candidate.pageNumber === 1)!;
}

function lastOf<T>(items: T[]): T {
  return items[items.length - 1];
}

function capitalized(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}
