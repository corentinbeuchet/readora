import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController, TestRequest } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { UploadStudioPage, parseChapterNumber } from '@app/features/upload/upload-studio-page';
import { API, fail, ok, provideHttpTesting } from '../../test-utils';

const WORK = { id: 'work-1', title: 'Blue Lock', synopsis: '', type: 'MANGA', status: 'ONGOING', coverImageUrl: '', genres: ['Action'] };
const CHAPTER = { id: 'chap-1', workId: 'work-1', chapterNumber: '3', title: '', status: 'PUBLISHED', pages: [] };
const SUCCESS = 'Series & Chapter Uploaded Successfully!';

/** Image double: page dimensions "decode" right away as 800 × 1200. */
class FakeImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  naturalWidth = 800;
  naturalHeight = 1200;
  set src(_: string) {
    queueMicrotask(() => this.onload?.());
  }
}

interface SeriesDraft {
  title: string;
  author?: string;
  demographic?: string;
  synopsis?: string;
}

interface Draft {
  series: SeriesDraft;
  chapter: { number: string; title?: string };
  pages: string[];
  mode?: 'DIRECT' | 'SCANLATION';
}

/** How the storage endpoint answers one page upload. */
type PageAnswer = { storageKey: string; cdnUrl: string; liteCdnUrl?: string } | { rejectedWith: string };

/**
 * The studio driven like a user: fields are typed into, buttons clicked, pages added through the file input, and the
 * API answered at the HTTP level. Nothing reads or calls the component's own members.
 */
describe('UploadStudioPage', () => {
  let fixture: ComponentFixture<UploadStudioPage>;
  let http: HttpTestingController;
  let created: string[];
  let revoked: string[];
  let createdBeforeStartingOver: string[];
  let workId: string;
  let workRequest: TestRequest;
  let chapterRequest: TestRequest;
  let taskRequest: TestRequest;
  let pageUploads: TestRequest[];

  beforeEach(async () => {
    created = [];
    revoked = [];
    vi.stubGlobal('Image', FakeImage);
    vi.spyOn(URL, 'createObjectURL').mockImplementation(() => {
      const url = `blob:test/${created.length + 1}`;
      created.push(url);
      return url;
    });
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation((url: string) => void revoked.push(url));
    await TestBed.configureTestingModule({
      imports: [UploadStudioPage],
      providers: [...provideHttpTesting(), provideRouter([])]
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(UploadStudioPage);
    fixture.detectChanges();
  });

  afterEach(() => {
    http.verify();
  });

  it('starts on the series step with defaults, and moves on only once the title is filled', async () => {
    await givenIOpenTheStudio();

    thenTheStepIs('1. Manga / Series Information');
    thenTheSeriesTypeIs('MANGA');
    thenTheSeriesStatusIs('ONGOING');
    thenICannotClick('Next: Chapter Setup');

    whenITypeTheTitle('   ');

    thenICannotClick('Next: Chapter Setup');
    thenTheTitleErrorSays('Give the series a title');

    whenITypeTheTitle('Solo Leveling');
    await whenIGoToTheChapterSetup();

    thenTheStepIs('2. Initial Chapter Details');
    thenTheChapterNumberIs('1');
  });

  it('renders the publishing mode as a labelled native radio group', async () => {
    await givenIAmOnTheChapterSetupOf('Tower of God');

    thenISeeTheFieldGroup('Publishing Pipeline');
    thenThereArePublishingModes(2);
    thenPublishingModeIsChecked(1);

    whenIChoosePublishingMode(2);

    thenPublishingModeIsChecked(2);
    thenModeCardIsSelected(2);
  });

  it('toggles genres as pressed buttons and adds custom genres', async () => {
    thenGenreIsPressed('Action');

    whenIToggleTheGenres('Action', 'Fantasy');

    thenGenreIsNotPressed('Action');
    thenGenreIsPressed('Fantasy');

    whenIAddTheCustomGenre('Cyberpunk');
    whenITypeTheTitle('Neon');
    await whenIGoToTheChapterSetup();
    whenIGoToThePages();

    thenICannotClick('Next: Review');

    await whenIAddPages('p1.png');
    whenIGoToTheReview();

    thenTheReviewSummaryShows('Fantasy, Cyberpunk');
  });

  it('only accepts a positive chapter number (never defaults to 1)', async () => {
    thenTheChapterNumberParsesAs('12.5', '12.5');
    thenTheChapterNumberParsesAs(' 010 ', '10');
    thenTheChapterNumbersAreRejected('', 'abc', '1abc', '0', '-2', '1e3', '1.');

    await givenIAmOnTheChapterSetupOf('Tower of God');

    whenITypeTheChapterNumber('1abc');

    thenICannotClick('Next: Upload Pages');
    thenTheChapterNumberIsMarkedInvalid();
    thenTheChapterNumberErrorSays('positive number such as 1, 10 or 12.5');

    whenITypeTheChapterNumber('12.5');
    whenIGoToThePages();

    thenTheStepIs('3. Chapter Pages');
  });

  it('step indicator marks the current step and only enables reachable steps', () => {
    thenTheStepButtonsDisabledAre([false, true, true, true]);
    thenStepIsCurrent(1);

    whenITypeTheTitle('Tower of God');

    thenTheStepButtonsDisabledAre([false, false, false, true]);

    whenIJumpToStep(2);

    thenTheStepIs('2. Initial Chapter Details');
    thenStepIsCurrent(2);
    thenStepIsCompleted(1);
  });

  it('publishes directly: creates the series, uploads the pages, publishes the chapter', async () => {
    await givenIAmOnTheReview({
      series: { title: 'Omniscient Reader', author: '  Sing Shong ', demographic: 'SHOUNEN', synopsis: 'Only I know the end of this world' },
      chapter: { number: '1', title: 'Prologue' },
      pages: ['p1.png']
    });

    await whenIPublish();
    await whenTheSeriesIsCreated({ ...WORK, id: 'work-123', title: 'Omniscient Reader' });

    thenTheSeriesWasCreatedWith({ title: 'Omniscient Reader', author: 'Sing Shong', demographic: 'SHOUNEN', synopsis: 'Only I know the end of this world' });

    await whenEveryPageUploads();
    await whenTheChapterIsPublished({ ...CHAPTER, id: 'chap-999', workId: 'work-123' });

    thenThePublishedChapterIncludes({ chapterNumber: '1', title: 'Prologue' });
    thenTheStepIs(SUCCESS);
    thenTheSuccessLinksAre(['/read/chap-999', '/works/work-123']);
  });

  it('shows the upload progress as a progressbar while publishing', async () => {
    await givenIAmOnTheReview({ series: { title: 'Blue Lock' }, chapter: { number: '3' }, pages: ['p1.png', 'p2.png'] });

    await whenIPublish();

    thenTheProgressBarRunsFrom(0, 100);
    thenTheProgressIsAboveZero();
    thenTheProgressSays('Creating series in catalog');

    // Answered so that no request is left pending.
    await whenCreatingTheSeriesFails('down', 503);
  });

  describe('publish failures and retries (HTTP level)', () => {
    it('retries only the failed page and reuses the already created Work', async () => {
      await givenIAmOnTheReview({ series: { title: 'Blue Lock' }, chapter: { number: '3' }, pages: ['p1.png', 'p2.png'] });

      await whenIPublish();
      await whenTheSeriesIsCreated(WORK);
      await whenThePageUploadsAnswer([
        { storageKey: 'k1', cdnUrl: 'https://cdn/k1', liteCdnUrl: 'https://cdn/k1.lite.jpg' },
        { rejectedWith: 'Storage unavailable' }
      ]);

      thenPageUploadsWereSent(2);
      thenThePagesWentToTheFolder('scans/work-1/c3');
      thenTheStepIs('4. Review & Confirmation');
      thenTheAlertSays('1 of 2 pages failed to upload');
      thenTheRetryHintMentions('Blue Lock');

      await whenIPublish();

      thenTheSeriesWasNotCreatedAgain();

      await whenThePageUploadsAnswer([{ storageKey: 'k2', cdnUrl: 'https://cdn/k2' }]);

      thenPageUploadsWereSent(1);

      await whenTheChapterIsPublished(CHAPTER);

      thenThePublishedChapterIs({
        chapterNumber: '3',
        title: undefined,
        pages: [
          { pageNumber: 1, storageKey: 'k1', cdnUrl: 'https://cdn/k1', width: 800, height: 1200, description: undefined, liteCdnUrl: 'https://cdn/k1.lite.jpg' },
          { pageNumber: 2, storageKey: 'k2', cdnUrl: 'https://cdn/k2', width: 800, height: 1200 }
        ]
      });
      thenTheStepIs(SUCCESS);
      thenTheFirstSuccessLinkIs('/read/chap-1');
    });

    it('surfaces the API message when creating the Work fails, and retries it', async () => {
      await givenIAmOnTheReview({ series: { title: 'Blue Lock' }, chapter: { number: '3' }, pages: ['p1.png', 'p2.png'] });

      await whenIPublish();
      await whenCreatingTheSeriesFails('Title already exists', 409);

      thenTheAlertSays('Title already exists');
      thenThereIsNoRetryHint();

      await whenIPublish();
      await whenTheSeriesIsCreated(WORK);
      await whenEveryPageUploads();
      await whenTheChapterIsPublished(CHAPTER);

      thenTheStepIs(SUCCESS);
    });
  });

  describe('scanlation mode', () => {
    it('reports a failed project lookup instead of swallowing it', async () => {
      await givenIAmOnTheReview({ series: { title: 'Blue Lock' }, chapter: { number: '3' }, pages: ['p1.png', 'p2.png'], mode: 'SCANLATION' });

      await whenIPublish();
      await whenTheSeriesIsCreated(WORK);
      await whenEveryPageUploads();
      await whenTheProjectLookupFails('Access denied');

      thenTheStepIs('4. Review & Confirmation');
      thenTheAlertSays('Access denied');
    });

    it('explains when the series has no project, then creates the task on retry', async () => {
      await givenIAmOnTheReview({ series: { title: 'Blue Lock' }, chapter: { number: '3' }, pages: ['p1.png', 'p2.png'], mode: 'SCANLATION' });

      await whenIPublish();
      await whenTheSeriesIsCreated(WORK);
      await whenEveryPageUploads();
      await whenTheSeriesHasProjects([]);

      thenTheAlertSays('No scanlation project exists');

      await whenIPublish();
      await whenTheSeriesHasProjects([{ id: 'proj-1' }]);
      await whenTheTaskIsCreated();

      thenTheTaskWasCreatedWith({ chapterNumber: 3, assetUrl: 'https://cdn/k0', pageCount: 2 });
      thenTheStepIs(SUCCESS);
      thenASuccessLinkIs('/scanlation/proj-1');
    });
  });

  describe('object URL lifecycle', () => {
    it('revokes the cover preview when it is changed or removed', () => {
      whenIPickTheCover('a.png');

      thenTheCoverPreviewIs('blob:test/1');

      whenIRemoveTheCover();

      thenTheRevokedUrlsAre(['blob:test/1']);

      whenIPickTheCover('b.png');
      whenIRemoveTheCover();

      thenTheRevokedUrlsAre(['blob:test/1', 'blob:test/2']);
      thenThereIsNoCoverPreview();
    });

    it('revokes cover and page previews when starting over, and on destroy', async () => {
      givenIPickedTheCover('a.png');
      await givenIAmOnTheReview({ series: { title: 'Blue Lock' }, chapter: { number: '3' }, pages: ['p1.png', 'p2.png'] });
      await givenIPublishedEverything();

      whenIStartOver();

      thenEveryPreviewCreatedBeforeStartingOverWasRevoked();
      thenTheStepIs('1. Manga / Series Information');

      whenIPickTheCover('b.png');
      whenITypeTheTitle('Again');
      await whenIGoToTheChapterSetup();
      whenIGoToThePages();
      await whenIAddPages('p9.png');
      whenILeaveTheStudio();

      thenEveryPreviewWasRevoked();
    });

    function givenIPickedTheCover(name: string): void {
      whenIPickTheCover(name);
    }

    async function givenIPublishedEverything(): Promise<void> {
      await whenIPublish();
      http.expectOne(`${API}/storage/upload?folder=covers`).flush(ok({ storageKey: 'c', cdnUrl: 'https://cdn/c' }));
      await settleStudio();
      await whenTheSeriesIsCreated(WORK);
      await whenEveryPageUploads();
      await whenTheChapterIsPublished(CHAPTER);
    }

    /** Picks a cover through the cover picker's (visually hidden) file input. */
    function whenIPickTheCover(name: string): void {
      const input: HTMLInputElement = page().querySelector('app-cover-picker input[type="file"]')!;
      Object.defineProperty(input, 'files', { value: [new File(['x'], name, { type: 'image/png' })], configurable: true });
      input.dispatchEvent(new Event('change'));
      fixture.detectChanges();
    }

    function whenIRemoveTheCover(): void {
      clickButton('Change Cover');
    }

    function whenIStartOver(): void {
      createdBeforeStartingOver = [...created];
      clickButton('Upload Another Manga');
    }

    function whenILeaveTheStudio(): void {
      fixture.destroy();
    }

    function thenTheCoverPreviewIs(src: string): void {
      expect(page().querySelector('app-cover-picker img')!.getAttribute('src')).toBe(src);
    }

    function thenThereIsNoCoverPreview(): void {
      expect(page().querySelector('app-cover-picker img')).toBeNull();
    }

    function thenTheRevokedUrlsAre(urls: string[]): void {
      expect(revoked).toEqual(urls);
    }

    function thenEveryPreviewCreatedBeforeStartingOverWasRevoked(): void {
      expect(revoked).toEqual(createdBeforeStartingOver);
    }

    function thenEveryPreviewWasRevoked(): void {
      expect(revoked).toEqual(created);
    }
  });

  async function givenIOpenTheStudio(): Promise<void> {
    await settleStudio();
  }

  async function givenIAmOnTheChapterSetupOf(title: string): Promise<void> {
    whenITypeTheTitle(title);
    await whenIGoToTheChapterSetup();
  }

  /** Fills the three steps as the user does, up to the review step. */
  async function givenIAmOnTheReview(draft: Draft): Promise<void> {
    typeSeries(draft.series);
    clickButton('Next: Chapter Setup');
    whenITypeTheChapterNumber(draft.chapter.number);
    if (draft.chapter.title !== undefined) {
      typeInto('#chapter-title', draft.chapter.title);
    }
    if (draft.mode === 'SCANLATION') {
      page().querySelector<HTMLInputElement>('input[value="SCANLATION"]')!.click();
      fixture.detectChanges();
    }
    whenIGoToThePages();
    await whenIAddPages(...draft.pages);
    whenIGoToTheReview();
  }

  function whenITypeTheTitle(title: string): void {
    typeInto('#manga-title', title);
  }

  function whenITypeTheChapterNumber(chapterNumber: string): void {
    typeInto('#chapter-number', chapterNumber);
  }

  async function whenIGoToTheChapterSetup(): Promise<void> {
    clickButton('Next: Chapter Setup');
    await settleStudio();
  }

  function whenIGoToThePages(): void {
    clickButton('Next: Upload Pages');
  }

  function whenIGoToTheReview(): void {
    clickButton('Next: Review');
  }

  function whenIChoosePublishingMode(position: number): void {
    publishingModes()[position - 1].click();
    fixture.detectChanges();
  }

  function whenIToggleTheGenres(...names: string[]): void {
    names.forEach((name) => genrePill(name).click());
    fixture.detectChanges();
  }

  function whenIAddTheCustomGenre(name: string): void {
    typeInto('input[aria-label="Custom genre"]', name);
    clickButton('Add');
  }

  function whenIJumpToStep(step: number): void {
    stepButtons()[step - 1].click();
    fixture.detectChanges();
  }

  async function whenIAddPages(...names: string[]): Promise<void> {
    const input = page().querySelector<HTMLInputElement>('app-page-grid-uploader input[type="file"]')!;
    Object.defineProperty(input, 'files', { value: names.map((n) => new File([n], n, { type: 'image/png' })), configurable: true });
    input.dispatchEvent(new Event('change'));
    await settleStudio();
  }

  async function whenIPublish(): Promise<void> {
    clickButton('Publish Series');
    await settleStudio();
  }

  async function whenTheSeriesIsCreated(work: typeof WORK): Promise<void> {
    workId = work.id;
    workRequest = http.expectOne({ method: 'POST', url: `${API}/works` });
    workRequest.flush(ok(work));
    await settleStudio();
  }

  async function whenCreatingTheSeriesFails(error: string, status: number): Promise<void> {
    http.expectOne(`${API}/works`).flush(fail(error), { status, statusText: 'Failure' });
    await settleStudio();
  }

  async function whenEveryPageUploads(): Promise<void> {
    uploads().forEach((r, i) => r.flush(ok({ storageKey: `k${i}`, cdnUrl: `https://cdn/k${i}` })));
    await settleStudio();
  }

  async function whenThePageUploadsAnswer(answers: PageAnswer[]): Promise<void> {
    pageUploads = uploads();
    pageUploads.forEach((request, i) => answerUpload(request, answers[i]));
    await settleStudio();
  }

  async function whenTheChapterIsPublished(chapter: typeof CHAPTER): Promise<void> {
    chapterRequest = http.expectOne(`${API}/works/${workId}/chapters/direct`);
    chapterRequest.flush(ok(chapter));
    await settleStudio();
  }

  async function whenTheProjectLookupFails(error: string): Promise<void> {
    http.expectOne(`${API}/works/${workId}/projects`).flush(fail(error), { status: 403, statusText: 'Forbidden' });
    await settleStudio();
  }

  async function whenTheSeriesHasProjects(projects: { id: string }[]): Promise<void> {
    http.expectOne(`${API}/works/${workId}/projects`).flush(ok(projects));
    await settleStudio();
  }

  async function whenTheTaskIsCreated(): Promise<void> {
    taskRequest = http.expectOne((r) => r.method === 'POST' && r.url.endsWith('/tasks'));
    taskRequest.flush(ok({ id: 'task-1' }));
    await settleStudio();
  }

  function thenTheStepIs(heading: string): void {
    expect(page().querySelector('.wizard-card h2')?.textContent?.trim() ?? '').toBe(heading);
  }

  function thenTheSeriesTypeIs(type: string): void {
    expect(page().querySelector<HTMLSelectElement>('#manga-type')!.value).toBe(type);
  }

  function thenTheSeriesStatusIs(status: string): void {
    expect(page().querySelector<HTMLSelectElement>('#manga-status')!.value).toBe(status);
  }

  function thenICannotClick(label: string): void {
    expect(button(label).disabled).toBe(true);
  }

  function thenTheTitleErrorSays(text: string): void {
    expect(page().querySelector('#manga-title-error')!.textContent).toContain(text);
  }

  function thenTheChapterNumberIs(chapterNumber: string): void {
    expect(page().querySelector<HTMLInputElement>('#chapter-number')!.value).toBe(chapterNumber);
  }

  function thenTheChapterNumberParsesAs(input: string, chapterNumber: string): void {
    expect(parseChapterNumber(input)).toBe(chapterNumber);
  }

  function thenTheChapterNumbersAreRejected(...inputs: string[]): void {
    inputs.forEach((input) => expect(parseChapterNumber(input)).toBeNull());
  }

  function thenTheChapterNumberIsMarkedInvalid(): void {
    expect(page().querySelector('#chapter-number')!.getAttribute('aria-invalid')).toBe('true');
  }

  function thenTheChapterNumberErrorSays(text: string): void {
    expect(page().querySelector('#chapter-number-error')!.textContent).toContain(text);
  }

  function thenISeeTheFieldGroup(legend: string): void {
    expect(Array.from(page().querySelectorAll('legend')).map((l) => l.textContent?.trim())).toContain(legend);
  }

  function thenThereArePublishingModes(count: number): void {
    expect(publishingModes().length).toBe(count);
  }

  function thenPublishingModeIsChecked(position: number): void {
    expect(publishingModes()[position - 1].checked).toBe(true);
  }

  function thenModeCardIsSelected(position: number): void {
    expect(page().querySelectorAll('.mode-card')[position - 1].classList).toContain('selected');
  }

  function thenGenreIsPressed(name: string): void {
    expect(genrePill(name).getAttribute('aria-pressed')).toBe('true');
  }

  function thenGenreIsNotPressed(name: string): void {
    expect(genrePill(name).getAttribute('aria-pressed')).toBe('false');
  }

  function thenTheReviewSummaryShows(text: string): void {
    expect(page().querySelector('.review-summary')?.textContent).toContain(text);
  }

  function thenTheStepButtonsDisabledAre(disabled: boolean[]): void {
    expect(stepButtons().map((b) => b.disabled)).toEqual(disabled);
  }

  function thenStepIsCurrent(step: number): void {
    expect(stepButtons()[step - 1].getAttribute('aria-current')).toBe('step');
  }

  function thenStepIsCompleted(step: number): void {
    expect(stepButtons()[step - 1].classList.contains('completed')).toBe(true);
  }

  function thenTheSeriesWasCreatedWith(fields: SeriesDraft): void {
    expect(workRequest.request.body).toMatchObject(fields);
  }

  function thenTheSeriesWasNotCreatedAgain(): void {
    http.expectNone({ method: 'POST', url: `${API}/works` });
  }

  function thenThePublishedChapterIncludes(fields: Record<string, unknown>): void {
    expect(chapterRequest.request.body).toMatchObject(fields);
  }

  function thenThePublishedChapterIs(body: Record<string, unknown>): void {
    expect(chapterRequest.request.body).toEqual(body);
  }

  function thenPageUploadsWereSent(count: number): void {
    expect(pageUploads.length).toBe(count);
  }

  function thenThePagesWentToTheFolder(folder: string): void {
    expect(pageUploads[0].request.urlWithParams).toContain(encodeURIComponent(folder));
  }

  function thenTheTaskWasCreatedWith(body: { chapterNumber: number; assetUrl: string; pageCount: number }): void {
    expect(taskRequest.request.body).toEqual(body);
  }

  function thenTheSuccessLinksAre(hrefs: string[]): void {
    expect(successLinks()).toEqual(hrefs);
  }

  function thenTheFirstSuccessLinkIs(href: string): void {
    expect(page().querySelector('.success-actions a')?.getAttribute('href')).toBe(href);
  }

  function thenASuccessLinkIs(href: string): void {
    expect(successLinks()).toContain(href);
  }

  function thenTheAlertSays(text: string): void {
    expect(page().querySelector('.studio-alert')?.textContent ?? '').toContain(text);
  }

  function thenTheRetryHintMentions(text: string): void {
    expect(page().querySelector('.retry-hint')?.textContent).toContain(text);
  }

  function thenThereIsNoRetryHint(): void {
    expect(page().querySelector('.retry-hint')).toBeNull();
  }

  function thenTheProgressBarRunsFrom(min: number, max: number): void {
    expect(progressBar().getAttribute('aria-valuemin')).toBe(String(min));
    expect(progressBar().getAttribute('aria-valuemax')).toBe(String(max));
  }

  function thenTheProgressIsAboveZero(): void {
    expect(Number(progressBar().getAttribute('aria-valuenow'))).toBeGreaterThan(0);
  }

  function thenTheProgressSays(text: string): void {
    expect(progressBar().getAttribute('aria-valuetext')).toContain(text);
  }

  function typeSeries(series: SeriesDraft): void {
    whenITypeTheTitle(series.title);
    const optionalFields: [string, string | undefined][] = [
      ['#manga-author', series.author],
      ['#manga-demographic', series.demographic],
      ['#manga-synopsis', series.synopsis]
    ];
    optionalFields.filter(([, value]) => value !== undefined).forEach(([selector, value]) => typeInto(selector, value!));
  }

  function answerUpload(request: TestRequest, answer: PageAnswer): void {
    if ('rejectedWith' in answer) {
      request.flush(fail(answer.rejectedWith), { status: 503, statusText: 'Service Unavailable' });
    } else {
      request.flush(ok(answer));
    }
  }

  async function settleStudio(): Promise<void> {
    for (let i = 0; i < 6; i++) {
      await Promise.resolve();
    }
    fixture.detectChanges();
  }

  function typeInto(selector: string, value: string): void {
    const field = page().querySelector(selector) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
    field.value = value;
    field.dispatchEvent(new Event('input'));
    field.dispatchEvent(new Event('change'));
    field.dispatchEvent(new Event('blur'));
    fixture.detectChanges();
  }

  function clickButton(label: string): void {
    button(label).click();
    fixture.detectChanges();
  }

  function page(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function button(label: string): HTMLButtonElement {
    const found = Array.from(page().querySelectorAll('button')).find((b) => b.textContent?.includes(label));
    if (!found) throw new Error(`No button "${label}"`);
    return found;
  }

  function genrePill(name: string): HTMLButtonElement {
    return Array.from(page().querySelectorAll<HTMLButtonElement>('.genre-pill')).find((b) => b.textContent?.trim() === name)!;
  }

  function publishingModes(): NodeListOf<HTMLInputElement> {
    return page().querySelectorAll<HTMLInputElement>('input[type="radio"][name="publishing-mode"]');
  }

  function stepButtons(): HTMLButtonElement[] {
    return Array.from(page().querySelectorAll<HTMLButtonElement>('app-wizard-steps button'));
  }

  function progressBar(): HTMLElement {
    return page().querySelector<HTMLElement>('[role="progressbar"]')!;
  }

  function successLinks(): (string | null)[] {
    return Array.from(page().querySelectorAll('.success-actions a')).map((a) => a.getAttribute('href'));
  }

  function uploads(): TestRequest[] {
    return http.match((r) => r.url.startsWith(`${API}/storage/upload`));
  }
});
