import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { ChapterReview } from '@app/features/moderation/moderation-page/chapter-review/chapter-review';
import { WaitingChapter } from '@app/core/models/chapter';
import { API, fail, ok, provideHttpTesting, settle } from '../../../../test-utils';

const WAITING: WaitingChapter = {
  chapterId: 'ch-1',
  work: { id: 'w-1', title: 'Omniscient Reader' },
  team: { id: 't-1', name: 'Nova Scans' },
  chapterNumber: '1',
  title: '',
  pages: [
    { pageNumber: 1, storageKey: 'r/p1.webp', cdnUrl: 'https://cdn.test/r/p1.webp', width: 800, height: 1200, description: null, liteCdnUrl: null },
    { pageNumber: 2, storageKey: 'r/p2.webp', cdnUrl: 'https://cdn.test/r/p2.webp', width: 800, height: 1200, description: null, liteCdnUrl: null }
  ],
  submittedAt: '2026-09-20T10:00:00Z'
};

describe('ChapterReview (US-11: a team first chapter waits for a moderator)', () => {
  let fixture: ComponentFixture<ChapterReview>;
  let http: HttpTestingController;
  /** The last decision's endpoint (`approve` / `send-back`). */
  let decision: string;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChapterReview],
      providers: [...provideHttpTesting()]
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('shows each waiting chapter with its series, team and pages to look through', async () => {
    await whenIOpenTheReview([WAITING]);

    thenTheChapterShows('Omniscient Reader');
    thenTheChapterShows('Chapter 1');
    thenTheChapterShows('Nova Scans');
    thenThePagesLinkTo(['https://cdn.test/r/p1.webp', 'https://cdn.test/r/p2.webp']);
  });

  it('says when nothing waits', async () => {
    await whenIOpenTheReview([]);

    thenICanSee('No chapter is waiting for review.');
  });

  it('publishes a chapter, says so, and loads the list again', async () => {
    await givenTheReviewHolds([WAITING]);

    await whenIDecide('Publish', WAITING, { listAfter: [] });

    thenTheDecisionWasSentTo('approve');
    thenTheStatusSays('Omniscient Reader chapter 1 is out.');
    thenICanSee('No chapter is waiting for review.');
  });

  it('sends a chapter back to its team', async () => {
    await givenTheReviewHolds([WAITING]);

    await whenIDecide('Send back', WAITING, { listAfter: [] });

    thenTheDecisionWasSentTo('send-back');
    thenTheStatusSays('Omniscient Reader chapter 1 went back to Nova Scans.');
  });

  it('a chapter someone else already reviewed says so and leaves the list', async () => {
    await givenTheReviewHolds([WAITING]);

    await whenIPublishButItWasAlreadyReviewed(WAITING, { listAfter: [] });

    thenTheAlertSays('This chapter was already reviewed.');
    thenTheStatusSays('');
    thenICanSee('No chapter is waiting for review.');
  });

  async function givenTheReviewHolds(chapters: WaitingChapter[]): Promise<void> {
    await whenIOpenTheReview(chapters);
  }

  async function whenIOpenTheReview(chapters: WaitingChapter[]): Promise<void> {
    fixture = TestBed.createComponent(ChapterReview);
    await settle(fixture);
    http.expectOne(`${API}/moderation/chapters`).flush(ok(chapters));
    await settle(fixture);
  }

  async function whenIDecide(action: 'Publish' | 'Send back', chapter: WaitingChapter, answer: { listAfter: WaitingChapter[] }): Promise<void> {
    button(action).click();
    const request = http.expectOne((r) => r.url.startsWith(`${API}/moderation/chapters/${chapter.chapterId}/`));
    decision = request.request.url.split('/').pop()!;
    request.flush(ok({ status: action === 'Publish' ? 'PUBLISHED' : 'DRAFT' }));
    await settle(fixture);
    http.expectOne(`${API}/moderation/chapters`).flush(ok(answer.listAfter));
    await settle(fixture);
  }

  async function whenIPublishButItWasAlreadyReviewed(chapter: WaitingChapter, answer: { listAfter: WaitingChapter[] }): Promise<void> {
    button('Publish').click();
    http.expectOne(`${API}/moderation/chapters/${chapter.chapterId}/approve`)
      .flush(fail('Chapter 1 is not waiting for review', 'CHAPTER_NOT_WAITING'), { status: 400, statusText: 'Bad Request' });
    await settle(fixture);
    http.expectOne(`${API}/moderation/chapters`).flush(ok(answer.listAfter));
    await settle(fixture);
  }

  function thenTheChapterShows(text: string): void {
    expect(page().querySelector('.waiting-item')!.textContent).toContain(text);
  }

  function thenThePagesLinkTo(hrefs: string[]): void {
    expect(Array.from(page().querySelectorAll('.waiting-pages a')).map((a) => a.getAttribute('href'))).toEqual(hrefs);
  }

  function thenTheDecisionWasSentTo(path: string): void {
    expect(decision).toBe(path);
  }

  function thenTheStatusSays(text: string): void {
    expect(page().querySelector('p[role="status"]')!.textContent!.trim()).toBe(text);
  }

  function thenTheAlertSays(text: string): void {
    expect(page().querySelector('[role="alert"]')!.textContent).toContain(text);
  }

  function thenICanSee(text: string): void {
    expect(page().textContent).toContain(text);
  }

  function button(name: string): HTMLButtonElement {
    return Array.from(page().querySelectorAll<HTMLButtonElement>('.waiting-actions button')).find((b) => b.textContent!.trim().startsWith(name))!;
  }

  function page(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }
});
