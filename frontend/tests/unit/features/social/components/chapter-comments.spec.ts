import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { ChapterComments, insertInThread } from '@app/features/social/components/chapter-comments';
import { AuthStore } from '@app/core/auth/auth-store';
import { ChapterComment } from '@app/core/models/readora.models';
import { environment } from '../../../../../src/environments/environment';
import { mockUser, signIn } from '../../../core/auth/auth-fixtures';
import { settle } from '../../../test-utils';

const API = environment.apiUrl;
const CHAPTER_ID = 'chap-1';

const COMMENTS: ChapterComment[] = [
  { id: 'c1', chapterId: CHAPTER_ID, authorId: 'u1', authorUsername: 'alice', content: 'Great chapter', depth: 1, isSpoiler: false, upvotes: 3, createdAt: '2026-09-13T00:00:00Z' },
  { id: 'c2', chapterId: CHAPTER_ID, authorId: 'u2', authorUsername: 'bob', content: 'He dies', parentId: 'c1', depth: 2, isSpoiler: true, upvotes: 0, createdAt: '2026-09-13T00:01:00Z' }
];

describe('ChapterComments', () => {
  let fixture: ComponentFixture<ChapterComments>;
  let http: HttpTestingController;
  let store: AuthStore;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChapterComments],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()]
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    store = TestBed.inject(AuthStore);
    fixture = TestBed.createComponent(ChapterComments);
    fixture.componentRef.setInput('chapterId', CHAPTER_ID);
  });

  afterEach(() => http.verify());

  async function render(): Promise<void> {
    await settle(fixture);
    http.expectOne(`${API}/comments/chapter/${CHAPTER_ID}`).flush({ success: true, data: COMMENTS, error: null });
    await settle(fixture);
  }

  async function submitCompose(): Promise<void> {
    q('form.compose')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await settle(fixture);
  }

  const q = (selector: string): HTMLElement | null => fixture.nativeElement.querySelector(selector);
  const all = (selector: string): HTMLElement[] => Array.from(fixture.nativeElement.querySelectorAll(selector));

  it('anonymous visitors see the thread but no compose box, no upvote and no reply buttons', async () => {
    await render();

    expect(fixture.nativeElement.textContent).toContain('Community Discussion (2)');
    expect(q('form.compose')).toBeNull();
    expect(q('.compose-hint')?.textContent).toContain('Log in');
    expect(all('.btn-upvote').length).toBe(0);
    expect(all('.btn-reply').length).toBe(0);
  });

  it('a READER can upvote (server total shown, repeat is idempotent) and post a comment under their identity', async () => {
    await signIn(store, http);
    await render();

    expect(q('form.compose')).not.toBeNull();
    all('.btn-upvote')[0].click();
    http.expectOne(`${API}/comments/c1/upvote`).flush({ success: true, data: { commentId: 'c1', upvotes: 4, counted: true }, error: null });
    await settle(fixture);
    expect(all('.btn-upvote')[0].textContent).toContain('4');

    // A second click is not counted again by the server; the UI keeps the server's total.
    all('.btn-upvote')[0].click();
    http.expectOne(`${API}/comments/c1/upvote`).flush({ success: true, data: { commentId: 'c1', upvotes: 4, counted: false }, error: null });
    await settle(fixture);
    expect(all('.btn-upvote')[0].textContent).toContain('4');

    // Empty submit shows the validation message and hits no endpoint.
    await submitCompose();
    expect(fixture.nativeElement.textContent).toContain('Write something before posting');
    http.expectNone(`${API}/comments/chapter/${CHAPTER_ID}`);

    const textarea = q('#comment-content') as HTMLTextAreaElement;
    textarea.value = 'Loved the art!';
    textarea.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await submitCompose();

    const post = http.expectOne(`${API}/comments/chapter/${CHAPTER_ID}`);
    expect(post.request.method).toBe('POST');
    expect(post.request.body).toEqual({ content: 'Loved the art!', isSpoiler: false, parentId: null, pageReference: null });
    // No authorId in the body: the backend takes it from the JWT.
    expect(post.request.body).not.toHaveProperty('authorId');
    post.flush({
      success: true,
      error: null,
      data: { id: 'c3', chapterId: CHAPTER_ID, authorId: 'user-1', authorUsername: 'reader', content: 'Loved the art!', depth: 1, isSpoiler: false, upvotes: 0, createdAt: '2026-09-13T00:02:00Z' }
    });
    await settle(fixture);

    expect(fixture.nativeElement.textContent).toContain('Community Discussion (3)');
    expect((q('#comment-content') as HTMLTextAreaElement).value).toBe('');
  });

  it('replying sends parentId and hides the page reference field', async () => {
    await signIn(store, http);
    await render();

    all('.btn-reply')[0].click();
    fixture.detectChanges();
    expect(q('.reply-banner')?.textContent).toContain('alice');
    expect(q('#comment-page')).toBeNull();

    const textarea = q('#comment-content') as HTMLTextAreaElement;
    textarea.value = 'Agreed!';
    textarea.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await submitCompose();

    const post = http.expectOne(`${API}/comments/chapter/${CHAPTER_ID}`);
    expect(post.request.body).toMatchObject({ content: 'Agreed!', parentId: 'c1', pageReference: null });
    post.flush({ success: true, error: null, data: { ...COMMENTS[1], id: 'c4', content: 'Agreed!', isSpoiler: false } });
    await settle(fixture);
    expect(q('.reply-banner')).toBeNull();
  });

  it('a user without COMMENT_UPVOTE sees vote counts but cannot upvote', async () => {
    await signIn(store, http, mockUser({ permissions: ['COMMENT_WRITE'] }));
    await render();
    expect(all('.btn-upvote').length).toBe(0);
    expect(all('.btn-reply').length).toBe(2);
  });

  it('keeps spoiler text out of the DOM until the reader reveals it', async () => {
    await render();

    expect(fixture.nativeElement.textContent).not.toContain('He dies');
    expect(q('.spoiler-placeholder')?.textContent).toContain('contains spoilers');

    (q('.btn-spoiler') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('He dies');
    expect(q('.btn-spoiler')).toBeNull();
  });

  it('shows a new reply under its parent thread, not at the bottom', async () => {
    await signIn(store, http);
    await settle(fixture);
    const later: ChapterComment = { ...COMMENTS[0], id: 'c3', authorUsername: 'carol', content: 'Later top-level', createdAt: '2026-09-13T00:05:00Z' };
    http.expectOne(`${API}/comments/chapter/${CHAPTER_ID}`).flush({ success: true, data: [...COMMENTS, later], error: null });
    await settle(fixture);

    all('.btn-reply')[0].click();
    fixture.detectChanges();
    const textarea = q('#comment-content') as HTMLTextAreaElement;
    textarea.value = 'Reply to alice';
    textarea.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await submitCompose();

    http.expectOne(`${API}/comments/chapter/${CHAPTER_ID}`).flush({
      success: true,
      error: null,
      data: { ...COMMENTS[1], id: 'c4', authorUsername: 'reader', content: 'Reply to alice', isSpoiler: false }
    });
    await settle(fixture);

    const authors = all('.comment-author').map((a) => a.textContent?.trim());
    expect(authors).toEqual(['alice', 'bob', 'reader', 'carol']);
  });

  it('insertInThread places replies after the parent subtree', () => {
    const c = (id: string, depth: number, parentId?: string): ChapterComment => ({ ...COMMENTS[0], id, depth, parentId });
    const thread = [c('a', 1), c('a1', 2, 'a'), c('a1x', 3, 'a1'), c('b', 1)];

    expect(insertInThread(thread, c('a2', 2, 'a')).map((x) => x.id)).toEqual(['a', 'a1', 'a1x', 'a2', 'b']);
    expect(insertInThread(thread, c('a1y', 3, 'a1')).map((x) => x.id)).toEqual(['a', 'a1', 'a1x', 'a1y', 'b']);
    expect(insertInThread(thread, c('b1', 2, 'b')).map((x) => x.id)).toEqual(['a', 'a1', 'a1x', 'b', 'b1']);
    expect(insertInThread(thread, c('z', 1)).map((x) => x.id)).toEqual(['a', 'a1', 'a1x', 'b', 'z']);
    expect(insertInThread(thread, c('orphan', 2, 'gone')).map((x) => x.id)).toEqual(['a', 'a1', 'a1x', 'b', 'orphan']);
  });
});
