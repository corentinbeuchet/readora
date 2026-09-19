import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController, TestRequest } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { ChapterComments, insertInThread } from '@app/features/social/components/chapter-comments';
import { AuthStore } from '@app/core/auth/auth-store';
import { ChapterComment, UserProfile } from '@app/core/models/readora.models';
import { mockUser, signIn } from '../../../core/auth/auth-fixtures';
import { API, fail, ok, provideHttpTesting, settle } from '../../../test-utils';

const CHAPTER_ID = 'chap-1';
const COMMENTS_URL = `${API}/comments/chapter/${CHAPTER_ID}`;

const COMMENTS: ChapterComment[] = [
  { id: 'c1', chapterId: CHAPTER_ID, authorId: 'u1', authorUsername: 'alice', content: 'Great chapter', depth: 1, isSpoiler: false, upvotes: 3, createdAt: '2026-09-13T00:00:00Z' },
  { id: 'c2', chapterId: CHAPTER_ID, authorId: 'u2', authorUsername: 'bob', content: 'He dies', parentId: 'c1', depth: 2, isSpoiler: true, upvotes: 0, createdAt: '2026-09-13T00:01:00Z' }
];
const LATER_TOP_LEVEL: ChapterComment = { ...COMMENTS[0], id: 'c3', authorUsername: 'carol', content: 'Later top-level', createdAt: '2026-09-13T00:05:00Z' };

describe('ChapterComments', () => {
  let fixture: ComponentFixture<ChapterComments>;
  let http: HttpTestingController;
  let store: AuthStore;
  let lastRequest: TestRequest;
  let scrolled: ReturnType<typeof vi.fn<() => void>>;
  let thread: ChapterComment[];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChapterComments],
      providers: [provideRouter([]), ...provideHttpTesting()]
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    store = TestBed.inject(AuthStore);
    fixture = TestBed.createComponent(ChapterComments);
    fixture.componentRef.setInput('chapterId', CHAPTER_ID);
  });

  // jsdom has no scrollIntoView, so it is assigned rather than spied (restoreMocks can't undo it): put it back.
  const originalScrollIntoView = Element.prototype.scrollIntoView;

  afterEach(() => {
    http.verify();
    Element.prototype.scrollIntoView = originalScrollIntoView;
  });

  it('anonymous visitors see the thread but no compose box, no upvote and no reply buttons', async () => {
    await givenIOpenTheDiscussion(COMMENTS);

    thenICanSee('Community Discussion (2)');
    thenThereIsNoComposeBox();
    thenTheComposeHintSays('Log in');
    thenISeeUpvoteButtons(0);
    thenISeeReplyButtons(0);
  });

  it('a READER can upvote (server total shown, repeat is idempotent) and post a comment under their identity', async () => {
    await givenIAmSignedIn();
    await givenIOpenTheDiscussion(COMMENTS);

    thenThereIsAComposeBox();

    await whenIUpvote('c1', { serverTotal: 4, counted: true });

    thenCommentHasUpvotes('c1', 4);

    await whenIUpvote('c1', { serverTotal: 4, counted: false });

    thenCommentHasUpvotes('c1', 4);

    await whenIPostAnEmptyComment();

    thenICanSee('Write something before posting');
    thenNoCommentWasPosted();

    await whenIPostTheComment('Loved the art!', { savedAs: { id: 'c3' } });

    thenTheCommentWasPostedWith({ content: 'Loved the art!', isSpoiler: false, parentId: null, pageReference: null });
    thenThePostedCommentCarriesNoAuthorId();
    thenICanSee('Community Discussion (3)');
    thenTheComposeBoxIsEmpty();
  });

  it('replying sends parentId and hides the page reference field', async () => {
    await givenIAmSignedIn();
    await givenIOpenTheDiscussion(COMMENTS);

    whenIClickReplyOn('c1');

    thenTheReplyBannerNames('alice');
    thenThereIsNoPageReferenceField();

    await whenIPostTheComment('Agreed!', { savedAs: { id: 'c4', parentId: 'c1', depth: 2 } });

    thenTheCommentWasPostedWith({ content: 'Agreed!', isSpoiler: false, parentId: 'c1', pageReference: null });
    thenThereIsNoReplyBanner();
  });

  it('a user without COMMENT_UPVOTE sees vote counts but cannot upvote', async () => {
    await givenIAmSignedIn({ permissions: ['COMMENT_WRITE'] });
    await givenIOpenTheDiscussion(COMMENTS);

    thenISeeUpvoteButtons(0);
    thenISeeReplyButtons(2);
  });

  it('keeps spoiler text out of the DOM until the reader reveals it', async () => {
    await givenIOpenTheDiscussion(COMMENTS);

    thenICannotSee('He dies');
    thenTheSpoilerPlaceholderSays('contains spoilers');

    whenIRevealTheSpoiler();

    thenICanSee('He dies');
    thenThereIsNoRevealButton();
  });

  it('shows a new reply under its parent thread, not at the bottom', async () => {
    await givenIAmSignedIn();
    await givenIOpenTheDiscussion([...COMMENTS, LATER_TOP_LEVEL]);

    whenIClickReplyOn('c1');
    await whenIPostTheComment('Reply to alice', { savedAs: { id: 'c4', parentId: 'c1', depth: 2, authorUsername: 'reader' } });

    thenTheAuthorsReadInOrder('alice', 'bob', 'reader', 'carol');
  });

  it('insertInThread places replies after the parent subtree', () => {
    givenTheThread(node('a', 1), node('a1', 2, 'a'), node('a1x', 3, 'a1'), node('b', 1));

    thenInsertingGivesTheOrder(node('a2', 2, 'a'), ['a', 'a1', 'a1x', 'a2', 'b']);
    thenInsertingGivesTheOrder(node('a1y', 3, 'a1'), ['a', 'a1', 'a1x', 'a1y', 'b']);
    thenInsertingGivesTheOrder(node('b1', 2, 'b'), ['a', 'a1', 'a1x', 'b', 'b1']);
    thenInsertingGivesTheOrder(node('z', 1), ['a', 'a1', 'a1x', 'b', 'z']);
    thenInsertingGivesTheOrder(node('orphan', 2, 'gone'), ['a', 'a1', 'a1x', 'b', 'orphan']);
  });

  it('highlights and scrolls to the comment a notification points to', async () => {
    givenScrollingIsRecorded();
    await givenIOpenTheDiscussionAt('c1', COMMENTS);

    thenCommentIsHighlighted('c1');
    thenCommentIsNotHighlighted('c2');
    thenThePageScrolledOnce();
  });

  it('reports someone else\'s comment with a reason (never your own)', async () => {
    await givenIAmSignedIn({ id: 'u2', permissions: ['COMMENT_WRITE', 'COMMENT_REPORT'] });
    await givenIOpenTheDiscussion(COMMENTS);

    // Only alice's comment: bob (u2) can't report his own.
    thenISeeReportButtons(1);

    await whenIReport('c1', 'HARASSMENT');

    thenTheReportWasSentWith({ reason: 'HARASSMENT' });
    thenTheReportDialogIsClosed();
    thenTheReportConfirmationSays('A moderator will look at it.');
  });

  it('shows the wait message when commenting too fast (429)', async () => {
    await givenIAmSignedIn({ permissions: ['COMMENT_WRITE'] });
    await givenIOpenTheDiscussion(COMMENTS);

    await whenIPostTheCommentTooFast('Again!', 'Please wait 7 seconds before commenting again');

    thenISeeTheError('Please wait 7 seconds before commenting again');
  });

  async function givenIAmSignedIn(user: Partial<UserProfile> = {}): Promise<void> {
    await signIn(store, http, mockUser(user));
  }

  async function givenIOpenTheDiscussion(comments: ChapterComment[]): Promise<void> {
    await settle(fixture);
    http.expectOne(COMMENTS_URL).flush(ok(comments));
    await settle(fixture);
  }

  async function givenIOpenTheDiscussionAt(commentId: string, comments: ChapterComment[]): Promise<void> {
    fixture.componentRef.setInput('highlightId', commentId);
    await givenIOpenTheDiscussion(comments);
  }

  function givenScrollingIsRecorded(): void {
    scrolled = vi.fn<() => void>();
    Element.prototype.scrollIntoView = scrolled;
  }

  function givenTheThread(...comments: ChapterComment[]): void {
    thread = comments;
  }

  async function whenIUpvote(commentId: string, answer: { serverTotal: number; counted: boolean }): Promise<void> {
    commentButton(commentId, '.btn-upvote').click();
    http.expectOne(`${API}/comments/${commentId}/upvote`).flush(ok({ commentId, upvotes: answer.serverTotal, counted: answer.counted }));
    await settle(fixture);
  }

  async function whenIPostAnEmptyComment(): Promise<void> {
    await submitCompose();
  }

  async function whenIPostTheComment(content: string, answer: { savedAs: Partial<ChapterComment> }): Promise<void> {
    typeComment(content);
    await submitCompose();
    lastRequest = http.expectOne(COMMENTS_URL);
    lastRequest.flush(
      ok({ id: 'c-new', chapterId: CHAPTER_ID, authorId: 'user-1', authorUsername: 'reader', content, depth: 1, isSpoiler: false, upvotes: 0, createdAt: '2026-09-13T00:02:00Z', ...answer.savedAs })
    );
    await settle(fixture);
  }

  async function whenIPostTheCommentTooFast(content: string, error: string): Promise<void> {
    typeComment(content);
    await submitCompose();
    http.expectOne(COMMENTS_URL).flush(fail(error), { status: 429, statusText: 'Too Many Requests' });
    await settle(fixture);
  }

  function whenIClickReplyOn(commentId: string): void {
    commentButton(commentId, '.btn-reply').click();
    fixture.detectChanges();
  }

  function whenIRevealTheSpoiler(): void {
    page().querySelector<HTMLButtonElement>('.btn-spoiler')!.click();
    fixture.detectChanges();
  }

  async function whenIReport(commentId: string, reason: string): Promise<void> {
    commentButton(commentId, '.btn-report').click();
    await settle(fixture);
    page().querySelector<HTMLInputElement>(`input[value="${reason}"]`)!.click();
    page().querySelector('[role="dialog"] form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    lastRequest = http.expectOne(`${API}/comments/${commentId}/reports`);
    lastRequest.flush(ok({ reportId: 'r-1' }));
    await settle(fixture);
  }

  function thenICanSee(text: string): void {
    expect(page().textContent).toContain(text);
  }

  function thenICannotSee(text: string): void {
    expect(page().textContent).not.toContain(text);
  }

  function thenThereIsNoComposeBox(): void {
    expect(page().querySelector('form.compose')).toBeNull();
  }

  function thenThereIsAComposeBox(): void {
    expect(page().querySelector('form.compose')).not.toBeNull();
  }

  function thenTheComposeHintSays(text: string): void {
    expect(page().querySelector('.compose-hint')?.textContent).toContain(text);
  }

  function thenISeeUpvoteButtons(count: number): void {
    expect(page().querySelectorAll('.btn-upvote').length).toBe(count);
  }

  function thenISeeReplyButtons(count: number): void {
    expect(page().querySelectorAll('.btn-reply').length).toBe(count);
  }

  function thenISeeReportButtons(count: number): void {
    expect(page().querySelectorAll('.btn-report')).toHaveLength(count);
  }

  function thenCommentHasUpvotes(commentId: string, upvotes: number): void {
    expect(commentButton(commentId, '.btn-upvote').textContent).toContain(String(upvotes));
  }

  function thenNoCommentWasPosted(): void {
    http.expectNone(COMMENTS_URL);
  }

  function thenTheCommentWasPostedWith(body: Record<string, unknown>): void {
    expect(lastRequest.request.method).toBe('POST');
    expect(lastRequest.request.body).toEqual(body);
  }

  /** The backend takes the author from the JWT. */
  function thenThePostedCommentCarriesNoAuthorId(): void {
    expect(lastRequest.request.body).not.toHaveProperty('authorId');
  }

  function thenTheComposeBoxIsEmpty(): void {
    expect(composeTextarea().value).toBe('');
  }

  function thenTheReplyBannerNames(author: string): void {
    expect(page().querySelector('.reply-banner')?.textContent).toContain(author);
  }

  function thenThereIsNoReplyBanner(): void {
    expect(page().querySelector('.reply-banner')).toBeNull();
  }

  function thenThereIsNoPageReferenceField(): void {
    expect(page().querySelector('#comment-page')).toBeNull();
  }

  function thenTheSpoilerPlaceholderSays(text: string): void {
    expect(page().querySelector('.spoiler-placeholder')?.textContent).toContain(text);
  }

  function thenThereIsNoRevealButton(): void {
    expect(page().querySelector('.btn-spoiler')).toBeNull();
  }

  function thenTheAuthorsReadInOrder(...authors: string[]): void {
    expect(Array.from(page().querySelectorAll('.comment-author')).map((a) => a.textContent?.trim())).toEqual(authors);
  }

  function thenInsertingGivesTheOrder(comment: ChapterComment, ids: string[]): void {
    expect(insertInThread(thread, comment).map((x) => x.id)).toEqual(ids);
  }

  function thenCommentIsHighlighted(commentId: string): void {
    expect(commentNode(commentId).classList).toContain('comment-highlight');
  }

  function thenCommentIsNotHighlighted(commentId: string): void {
    expect(commentNode(commentId).classList).not.toContain('comment-highlight');
  }

  function thenThePageScrolledOnce(): void {
    expect(scrolled).toHaveBeenCalledTimes(1);
  }

  function thenTheReportWasSentWith(body: { reason: string }): void {
    expect(lastRequest.request.body).toEqual(body);
  }

  function thenTheReportDialogIsClosed(): void {
    expect(page().querySelector('[role="dialog"]')).toBeNull();
  }

  function thenTheReportConfirmationSays(text: string): void {
    expect(page().querySelector('.report-confirmation')!.textContent).toContain(text);
  }

  function thenISeeTheError(text: string): void {
    expect(page().querySelector('[role="alert"]')!.textContent).toContain(text);
  }

  function node(id: string, depth: number, parentId?: string): ChapterComment {
    return { ...COMMENTS[0], id, depth, parentId };
  }

  function typeComment(content: string): void {
    composeTextarea().value = content;
    composeTextarea().dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  async function submitCompose(): Promise<void> {
    page().querySelector('form.compose')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await settle(fixture);
  }

  function page(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function composeTextarea(): HTMLTextAreaElement {
    return page().querySelector<HTMLTextAreaElement>('#comment-content')!;
  }

  function commentNode(commentId: string): HTMLElement {
    return page().querySelector<HTMLElement>(`#comment-${commentId}`)!;
  }

  function commentButton(commentId: string, selector: string): HTMLButtonElement {
    return commentNode(commentId).querySelector<HTMLButtonElement>(selector)!;
  }
});
