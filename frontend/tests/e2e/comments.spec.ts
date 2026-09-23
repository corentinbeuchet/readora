import { Page } from '@playwright/test';
import { test, expect } from './support/fixtures';
import { PostedComment, signUp, uniqueSuffix } from './support/helpers';

/** US-03 chapter comments and US-11 reports, from a reader's side. The moderator's side is in moderation.spec.ts. */
test.describe('Chapter comments', () => {
  test('a chapter nobody discussed yet has an empty discussion', async ({ page, publishedChapter }) => {
    await givenIAmReadingTheDiscussionOf(page, publishedChapter.chapterId);

    await thenTheDiscussionHasComments(page, 0);
  });

  test('a signed-out visitor reads the discussion and is asked to log in to join it', async ({ page, commentedChapter }) => {
    await givenIAmReadingTheDiscussionOf(page, commentedChapter.chapterId);

    await thenISeeTheComment(page, commentedChapter);
    await thenIAmAskedToLogInToComment(page);
  });

  test('a spoiler stays hidden until I choose to see it', async ({ page, spoilerComment }) => {
    await givenIAmReadingTheDiscussionOf(page, spoilerComment.chapterId);
    await thenTheSpoilerIsHidden(page, spoilerComment);

    await whenIShowTheSpoiler(page);

    await thenISeeTheComment(page, spoilerComment);
  });

  test.describe('signed in', () => {
    // Playwright's WebKit for Windows crashes the page after a sign-up here (frontend AGENTS.md R27).
    test.skip(({ browserName, isMobile }) => browserName === 'webkit' && isMobile, 'R27: Page crashed on Mobile Safari (Windows)');

    test('a reader posts a comment and sees it in the discussion', async ({ page, publishedChapter }) => {
      const me = await givenIAmASignedInReader(page);
      await givenIAmReadingTheDiscussionOf(page, publishedChapter.chapterId);

      const content = await whenIPostAComment(page);

      await thenTheDiscussionHasComments(page, 1);
      await thenISeeTheComment(page, { author: me, content });
    });

    test('a reply appears right under the comment it answers', async ({ page, commentedChapter }) => {
      await givenIAmASignedInReader(page);
      await givenIAmReadingTheDiscussionOf(page, commentedChapter.chapterId);

      const reply = await whenIReplyTo(page, commentedChapter);

      await thenTheCommentsAreInThisOrder(page, [commentedChapter.content, reply]);
      await thenTheCommentIsAReply(page, reply);
    });

    test("a reader reports someone else's comment", async ({ page, commentedChapter }) => {
      await givenIAmASignedInReader(page);
      await givenIAmReadingTheDiscussionOf(page, commentedChapter.chapterId);

      await whenIReportTheCommentOf(page, commentedChapter.author, 'Spam or scam');

      await thenIAmThankedForTheReport(page);
    });

    test('commenting again right away asks to wait', async ({ page, publishedChapter }) => {
      const me = await givenIAmASignedInReader(page);
      await givenIAmReadingTheDiscussionOf(page, publishedChapter.chapterId);
      const first = await whenIPostAComment(page);
      await thenISeeTheComment(page, { author: me, content: first });

      await whenIPostAComment(page);

      await thenIAmAskedToWaitBeforeCommentingAgain(page);
    });
  });
});

async function givenIAmASignedInReader(page: Page): Promise<string> {
  return signUp(page, 'reader');
}

/**
 * Comments load when their placeholder, under the pages, scrolls into view (at once when the pages are short). The
 * window is scrolled rather than the placeholder, which may be replaced while Playwright scrolls to it.
 */
async function givenIAmReadingTheDiscussionOf(page: Page, chapterId: string): Promise<void> {
  await page.goto(`/read/${chapterId}`);
  const discussion = page.getByRole('heading', { name: /^Community Discussion/ });
  await expect(page.getByText('Comments load when you scroll here.').or(discussion)).toBeAttached();
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expect(discussion).toBeVisible();
}

async function whenIPostAComment(page: Page): Promise<string> {
  const content = `My comment ${uniqueSuffix()}`;
  await page.getByLabel('Add a comment').fill(content);
  await page.getByRole('button', { name: 'Post comment' }).click();
  return content;
}

async function whenIReplyTo(page: Page, comment: PostedComment): Promise<string> {
  const content = `My reply ${uniqueSuffix()}`;
  await commentItem(page, comment.content).getByRole('button', { name: 'Reply' }).click();
  await page.getByLabel('Your reply').fill(content);
  await page.getByRole('button', { name: 'Post reply' }).click();
  return content;
}

async function whenIShowTheSpoiler(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Show Spoiler' }).click();
}

async function whenIReportTheCommentOf(page: Page, author: string, reason: string): Promise<void> {
  await page.getByRole('button', { name: `Report comment by ${author}` }).click();
  const dialog = page.getByRole('dialog', { name: `Report ${author}'s comment` });
  await dialog.getByRole('radio', { name: reason }).check();
  await dialog.getByRole('button', { name: 'Send report' }).click();
}

async function thenTheDiscussionHasComments(page: Page, count: number): Promise<void> {
  await expect(page.getByRole('heading', { name: `Community Discussion (${count})` })).toBeVisible();
}

async function thenISeeTheComment(page: Page, comment: { author: string; content: string }): Promise<void> {
  await expect(commentItem(page, comment.content).getByRole('link', { name: comment.author })).toBeVisible();
}

async function thenIAmAskedToLogInToComment(page: Page): Promise<void> {
  await expect(page.getByText('to join the discussion.')).toBeVisible();
  await expect(page.getByLabel('Add a comment')).toHaveCount(0);
}

async function thenTheCommentsAreInThisOrder(page: Page, contents: string[]): Promise<void> {
  // Contents are letters, digits and `_` only (uniqueSuffix), so they need no escaping.
  const discussion = page.getByRole('region', { name: /^Community Discussion/ });
  await expect(discussion.getByRole('listitem')).toHaveText(contents.map((content) => new RegExp(content)));
}

/** Screen readers get the reply depth from `aria-level`, the indent shows it. */
async function thenTheCommentIsAReply(page: Page, content: string): Promise<void> {
  await expect(commentItem(page, content)).toHaveAttribute('aria-level', '2');
}

async function thenTheSpoilerIsHidden(page: Page, comment: PostedComment): Promise<void> {
  await expect(page.getByText('This comment contains spoilers.')).toBeVisible();
  await expect(page.getByText(comment.content)).toHaveCount(0);
}

async function thenIAmThankedForTheReport(page: Page): Promise<void> {
  await expect(page.getByRole('status').filter({ hasText: 'Thanks! A moderator will look at it.' })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

async function thenIAmAskedToWaitBeforeCommentingAgain(page: Page): Promise<void> {
  await expect(page.getByRole('alert')).toHaveText(/^Please wait \d+ s and try again\.$/);
}

function commentItem(page: Page, content: string) {
  return page.getByRole('listitem').filter({ hasText: content });
}
