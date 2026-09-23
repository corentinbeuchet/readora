import { APIRequestContext, Page } from '@playwright/test';
import { test, expect } from './support/fixtures';
import { PostedComment, givenIAmLoggedInAsTheModerator, signUp, visibleCommentsOf } from './support/helpers';

/**
 * US-11 moderation queue, with the seed `moderator` account. The queue is shared by every test (and holds the seed's
 * reports), so each test finds its own report by the comment's unique content.
 */
test.describe('Moderation queue', () => {
  test('a moderator sees a reported comment with its reason and a link to it', async ({ page, reportedComment }) => {
    await givenIAmLoggedInAsTheModerator(page);

    await whenIOpenTheModerationQueue(page);

    await thenTheReportIsQueued(page, reportedComment, 'Spam or scam');
    await thenICanSeeItInContext(page, reportedComment);
  });

  test('hiding a reported comment removes it for readers', async ({ page, request, reportedComment }) => {
    await givenIAmLoggedInAsTheModerator(page);
    await whenIOpenTheModerationQueue(page);

    await whenIHideTheCommentOf(page, reportedComment.author);

    await thenTheReportIsNoLongerQueued(page, reportedComment);
    await thenReadersNoLongerSeeTheComment(request, reportedComment);
  });

  test('dismissing a report clears it and keeps the comment', async ({ page, request, reportedComment }) => {
    await givenIAmLoggedInAsTheModerator(page);
    await whenIOpenTheModerationQueue(page);

    await whenIDismissTheReportOnTheCommentOf(page, reportedComment.author);

    await thenTheReportIsNoLongerQueued(page, reportedComment);
    await thenReadersStillSeeTheComment(request, reportedComment);
  });

  test.describe('as a reader', () => {
    // Playwright's WebKit for Windows crashes the page after a sign-up (frontend AGENTS.md R27).
    test.skip(({ browserName, isMobile }) => browserName === 'webkit' && isMobile, 'R27: Page crashed on Mobile Safari (Windows)');

    test('a reader without moderation rights is refused the queue', async ({ page }) => {
      await signUp(page, 'reader');

      await whenIOpenTheModerationQueue(page);

      await thenIAmRefused(page);
    });
  });
});

async function whenIOpenTheModerationQueue(page: Page): Promise<void> {
  await page.goto('/moderation');
}

async function whenIHideTheCommentOf(page: Page, author: string): Promise<void> {
  await page.getByRole('button', { name: `Hide comment by ${author}` }).click();
}

async function whenIDismissTheReportOnTheCommentOf(page: Page, author: string): Promise<void> {
  await page.getByRole('button', { name: `Dismiss report on the comment by ${author}` }).click();
}

async function thenTheReportIsQueued(page: Page, comment: PostedComment, reason: string): Promise<void> {
  await expect(queueItem(page, comment)).toContainText(reason);
  await expect(queueItem(page, comment)).toContainText(`comment by ${comment.author}`);
}

async function thenICanSeeItInContext(page: Page, comment: PostedComment): Promise<void> {
  await expect(queueItem(page, comment).getByRole('link', { name: 'See in context' })).toHaveAttribute(
    'href',
    `/read/${comment.chapterId}?comment=${comment.commentId}`
  );
}

async function thenTheReportIsNoLongerQueued(page: Page, comment: PostedComment): Promise<void> {
  await expect(queueItem(page, comment)).toHaveCount(0);
}

async function thenReadersNoLongerSeeTheComment(request: APIRequestContext, comment: PostedComment): Promise<void> {
  await expect.poll(() => visibleCommentsOf(request, comment.chapterId), { timeout: 5000 }).not.toContain(comment.content);
}

async function thenReadersStillSeeTheComment(request: APIRequestContext, comment: PostedComment): Promise<void> {
  expect(await visibleCommentsOf(request, comment.chapterId)).toContain(comment.content);
}

async function thenIAmRefused(page: Page): Promise<void> {
  await expect(page).toHaveURL(/\/forbidden/);
}

function queueItem(page: Page, comment: PostedComment) {
  return page.getByRole('listitem').filter({ hasText: comment.content });
}
