import { APIRequestContext, Page, Request, expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';
import { test } from '../fixtures';
import { Story } from '../story';
import { createAList, logIn } from '../../support/helpers';
import { whenIOpenTheSeries } from '../../support/series-page';

/** US-05 reading lists: adding a series to a list from its page. */
const { Given, When, Then } = createBdd(test);

/** The requests for my lists a page made, before and after "Add to a list" was opened (by page). */
const listRequests = new WeakMap<Page, { beforeOpening: number; afterOpening: number; opened: boolean }>();

Given('reader {string} has a free account', async ({ story }, reader: string) => {
  await story.newReader(reader);
  story.follow(reader);
});

Given('the series {string} and {string} are in the catalog', async ({ story }, first: string, second: string) => {
  await story.series(first);
  await story.series(second);
});

Given('{string} has the lists {string} and {string}', async ({ request, story }, reader: string, first: string, second: string) => {
  await givenIHaveTheLists(request, story, reader, [first, second]);
});

When(
  '{string} opens {string} on the page of {string} and adds it to {string} with the note {string}',
  async ({ page, story }, reader: string, _button: string, series: string, list: string, note: string) => {
    await logIn(page, story.account(reader));
    await givenICountTheRequestsForMyLists(page);
    await whenIOpenTheSeries(page, await story.series(series));
    await whenIOpenAddToAList(page);
    await whenIAddItToTheListWithANote(page, list, note);
  }
);

Then('{string} holds {string} with the note {string}', async ({ page, story }, list: string, series: string, note: string) => {
  await whenIOpenTheList(page, story.recall(`list ${list}`));
  await thenTheListHoldsTheSeriesWithTheNote(page, (await story.series(series)).title, note);
});

Then("Kenji's lists are only fetched once he opens {string}", async ({ page }, _button: string) => {
  await thenMyListsWereFetchedOnlyAfterOpening(page);
});

async function givenIHaveTheLists(request: APIRequestContext, story: Story, reader: string, titles: string[]): Promise<void> {
  const account = story.account(reader);
  for (const title of titles) {
    story.remember(`list ${title}`, await createAList(request, { username: account.username!, email: account.email, accessToken: account.accessToken! }, title));
  }
}

/** Counts `GET /lists/mine` from now on, split at the moment "Add to a list" is opened. */
async function givenICountTheRequestsForMyLists(page: Page): Promise<void> {
  const counts = { beforeOpening: 0, afterOpening: 0, opened: false };
  listRequests.set(page, counts);
  page.on('request', (request: Request) => {
    if (request.method() === 'GET' && new URL(request.url()).pathname.endsWith('/lists/mine')) {
      if (counts.opened) {
        counts.afterOpening++;
      } else {
        counts.beforeOpening++;
      }
    }
  });
}

async function whenIOpenAddToAList(page: Page): Promise<void> {
  listRequests.get(page)!.opened = true;
  await page.getByRole('button', { name: 'Add to a list' }).click();
}

async function whenIAddItToTheListWithANote(page: Page, list: string, note: string): Promise<void> {
  await page.getByLabel('List').selectOption({ label: list });
  await page.getByLabel('Note (optional)').fill(note);
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: `Added to “${list}”.` })).toBeVisible();
}

async function whenIOpenTheList(page: Page, listId: string): Promise<void> {
  await page.goto(`/lists/${listId}`);
}

async function thenTheListHoldsTheSeriesWithTheNote(page: Page, title: string, note: string): Promise<void> {
  const item = page.getByRole('listitem').filter({ has: page.getByRole('link', { name: title, exact: true }) });
  await expect(item).toContainText(note);
}

async function thenMyListsWereFetchedOnlyAfterOpening(page: Page): Promise<void> {
  const counts = listRequests.get(page)!;
  expect(counts.beforeOpening).toBe(0);
  expect(counts.afterOpening).toBeGreaterThan(0);
}
