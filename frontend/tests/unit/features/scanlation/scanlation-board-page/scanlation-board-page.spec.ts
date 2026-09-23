import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController, TestRequest } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { ScanlationBoardPage } from '@app/features/scanlation/scanlation-board-page/scanlation-board-page';
import { ScanlationProject, WorkflowTask } from '@app/core/models/scanlation';
import { givenIAmSignedInWith } from '../../../core/auth/auth-fixtures';
import { API, InstantImage, choosePageFiles, fail, ok, provideHttpTesting, settle } from '../../../test-utils';
import { PageAsset, PagePayload } from '@app/core/models/chapter';

const PROJECT_ID = 'proj-1';
const TASKS_URL = `${API}/scanlation/projects/${PROJECT_ID}/tasks`;

const RAW_TASK: WorkflowTask = { id: 't-raw', chapterNumber: '10', stage: 'RAW_UPLOADED', status: 'PENDING', assigneeId: null, pageCount: 2, pages: [rawPage(1), rawPage(2)], updatedAt: '2026-09-13T00:00:00Z' };
const MY_TASK: WorkflowTask = { id: 't-mine', chapterNumber: '11', stage: 'CLEANING', status: 'IN_PROGRESS', assigneeId: 'user-1', pageCount: 1, pages: [rawPage(1)], updatedAt: '2026-09-13T00:00:00Z' };
const QC_TASK: WorkflowTask = { id: 't-qc', chapterNumber: '9', stage: 'QC_REVIEW', status: 'PENDING', assigneeId: null, pageCount: 1, pages: [rawPage(1)], updatedAt: '2026-09-13T00:00:00Z' };

function rawPage(pageNumber: number): PageAsset {
  return { pageNumber, storageKey: `raw/p${pageNumber}.webp`, cdnUrl: `https://cdn.test/raw/p${pageNumber}.webp`, width: 800, height: 1200, description: null, liteCdnUrl: null };
}

const PROJECT: ScanlationProject = {
  id: PROJECT_ID,
  name: 'FlameScans Solo Leveling',
  workId: 'work-1',
  teamId: 'team-1',
  teamName: 'Shadow Scans',
  boardEnabled: true,
  members: [{ userId: 'user-1', roles: ['CLEANER_REDRAWER', 'QUALITY_CHECKER'] }],
  tasks: [RAW_TASK, MY_TASK, QC_TASK]
};

describe('ScanlationBoardPage (API-driven, gated by team roles)', () => {
  let fixture: ComponentFixture<ScanlationBoardPage>;
  let http: HttpTestingController;
  let lastRequest: TestRequest;
  let taskInDialog: WorkflowTask;
  let pageUploads: TestRequest[];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ScanlationBoardPage],
      providers: [provideRouter([]), ...provideHttpTesting()]
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    // The submit dialog reads each chosen page's size from a preview.
    vi.stubGlobal('Image', InstantImage);
    vi.spyOn(URL, 'createObjectURL').mockImplementation(() => 'blob:test/page');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    fixture = TestBed.createComponent(ScanlationBoardPage);
    fixture.componentRef.setInput('projectId', PROJECT_ID);
  });

  afterEach(() => http.verify());

  it('loads the project from the API and groups tasks by stage', async () => {
    await givenIAmSignedInWith(['LIBRARY_USE']);
    await givenIOpenTheBoard(PROJECT);

    thenTheTitleShows('FlameScans Solo Leveling');
    thenColumnHasTasks('RAW_UPLOADED', 1);
    thenColumnHasTasks('QC_REVIEW', 1);
    thenTheBoardHasTasks(3);
  });

  it('says when the team does not use a task board for this series', async () => {
    await givenIAmSignedInWith(['LIBRARY_USE']);
    await givenIOpenTheBoard({ ...PROJECT, boardEnabled: false });

    thenICanSee('The team does not use a task board for this series');
  });

  it('says a missing project does not exist, with nothing to retry', async () => {
    await givenIAmSignedInWith(['LIBRARY_USE']);

    await whenTheProjectFailsToLoad({ status: 404 });

    thenISeeTheError("This project doesn't exist.");
    thenICanRetry(false);
  });

  it('offers Retry when the project cannot be reached, and Retry loads the board', async () => {
    await givenIAmSignedInWith(['LIBRARY_USE']);

    await whenTheProjectFailsToLoad({ status: 0 });

    thenISeeTheError('This project could not be loaded.');
    thenICanRetry(true);

    await whenIRetryAndTheProjectLoads(PROJECT);

    thenTheBoardHasTasks(3);
  });

  it('a member sees no Claim or Publish on stages outside their roles', async () => {
    await givenIAmSignedInWith(['LIBRARY_USE']);
    await givenIOpenTheBoard({ ...PROJECT, members: [{ userId: 'user-1', roles: ['TRANSLATOR'] }], tasks: [RAW_TASK, QC_TASK] });

    thenISeeClaimButtons(0);
    thenISeeSubmitButtons(0);
    thenISeePublishButtons(0);
  });

  it('a member sees Claim in the stages they work on, Submit on their own task and Publish on QC tasks', async () => {
    await givenIAmSignedInWith(['LIBRARY_USE']);
    await givenIOpenTheBoard(PROJECT);

    thenISeeClaimButtons(2);
    thenISeeSubmitButtons(1);
    thenISeePublishButtons(1);
  });

  it('Claim calls the API and updates the board from the response', async () => {
    await givenIAmSignedInWith(['LIBRARY_USE']);
    await givenIOpenTheBoard(PROJECT);

    await whenIClaim(RAW_TASK, { assignedTo: 'user-1' });

    thenTheRequestWasAPost();
    thenTheRequestCarriesNoIdentity();
    thenTaskCardShows('RAW_UPLOADED', 1, 'Assigned: ');
    thenICanSee('Assigned: you');
  });

  it('a task lists the pages the last stage left, as links to open them', async () => {
    await givenIAmSignedInWith(['LIBRARY_USE']);
    await givenIOpenTheBoard(PROJECT);

    thenTaskCardShows('RAW_UPLOADED', 1, '2 pages');
    thenTheTaskLinksToItsPages(RAW_TASK, ['https://cdn.test/raw/p1.webp', 'https://cdn.test/raw/p2.webp']);
  });

  it('Submit uploads the pages of my stage, then the task moves on to the next stage with them', async () => {
    await givenIAmSignedInWith(['LIBRARY_USE']);
    await givenIOpenTheBoard(PROJECT);

    await whenIOpenTheSubmitDialogFor(MY_TASK);

    thenTheSubmitDialogIsOpen();

    await whenISubmitTheDialog();

    thenISeeTheError('Add the pages of your stage first.');
    thenNothingWasSubmittedFor(MY_TASK);

    await whenIAddPages('p1.png', 'p2.png');
    await whenISubmitTheDialog();
    await whenThePagesUpload(['ok', 'ok']);
    await whenTheServerMovesTheTaskTo('TRANSLATING');

    thenThePagesWentToTheFolder('scans/work-1/c11/cleaning');
    thenTheSubmissionWas([uploadedPage(1, 'k1'), uploadedPage(2, 'k2')]);
    thenTheSubmitDialogIsClosed();
    thenColumnHasTasks('TRANSLATING', 1);
    thenColumnHasTasks('CLEANING', 0);
  });

  it('a page that failed to upload is sent again on the next submit, and the task waits until all are uploaded', async () => {
    await givenIAmSignedInWith(['LIBRARY_USE']);
    await givenIOpenTheBoard(PROJECT);
    await whenIOpenTheSubmitDialogFor(MY_TASK);
    await whenIAddPages('p1.png', 'p2.png');

    await whenISubmitTheDialog();
    await whenThePagesUpload(['ok', 'fails']);

    thenISeeTheError('Pages not uploaded: 1. Submit again to send them.');
    thenNothingWasSubmittedFor(MY_TASK);

    await whenISubmitTheDialog();
    await whenThePagesUpload(['ok']);
    await whenTheServerMovesTheTaskTo('TRANSLATING');

    thenThisManyPagesWereUploaded(1);
    thenTheSubmissionWas([uploadedPage(1, 'k1'), uploadedPage(2, 'k1')]);
    thenTheSubmitDialogIsClosed();
  });

  it('Publish calls the API and moves the task to PUBLISHED; API errors are shown', async () => {
    await givenIAmSignedInWith(['LIBRARY_USE']);
    await givenIOpenTheBoard(PROJECT);

    await whenIPublishButItIsRefused(QC_TASK, 'User is not a member of this project');

    thenISeeTheError('not a member');
    thenColumnHasTasks('QC_REVIEW', 1);

    await whenIPublish(QC_TASK);

    thenColumnHasTasks('PUBLISHED', 1);
    thenColumnHasTasks('QC_REVIEW', 0);
  });

  it('Upload Studio link is rendered and points to /upload for every member', async () => {
    await givenIAmSignedInWith(['LIBRARY_USE']);
    await givenIOpenTheBoard(PROJECT);

    thenThereIsAnUploadStudioLink();
    thenTheUploadStudioLinkPointsTo('/upload');
    thenTheUploadStudioLinkReads('Upload Studio');
  });

  it('does not show the previous project while another one loads or when it fails', async () => {
    await givenIAmSignedInWith(['LIBRARY_USE']);
    await givenIOpenTheBoard(PROJECT);

    thenTheTitleShows('FlameScans Solo Leveling');

    await whenISwitchToProject('proj-2');

    thenICannotSee('FlameScans Solo Leveling');
    thenTheBoardHasTasks(0);

    await whenTheProjectIsNotFound('proj-2');

    thenICannotSee('FlameScans Solo Leveling');
  });

  describe('submit dialog accessibility', () => {
    let trigger: HTMLButtonElement;
    let lastKey: KeyboardEvent;

    it('moves focus into the dialog, traps Tab, closes on Escape and returns focus', async () => {
      await givenTheSubmitDialogIsOpenFromItsButton(MY_TASK);

      thenFocusIsOnThePageDropZone();

      whenIFocusTheLastDialogButton();
      whenIPress('Tab');

      thenTheKeyWasTrapped();
      thenFocusIsOnThePageDropZone();

      whenIPress('Tab', { shift: true });

      thenTheKeyWasTrapped();
      thenFocusIsOnTheLastDialogButton();

      await whenIPressEscape();

      thenTheSubmitDialogIsClosed();
      thenFocusIsBackOnTheSubmitButton();
    });

    async function givenTheSubmitDialogIsOpenFromItsButton(task: WorkflowTask): Promise<void> {
      await givenIAmSignedInWith(['LIBRARY_USE']);
      await givenIOpenTheBoard(PROJECT);
      trigger = taskButton(task, '.btn-submit');
      trigger.focus();
      await whenIOpenTheSubmitDialogFor(task);
    }

    function whenIFocusTheLastDialogButton(): void {
      lastDialogButton().focus();
    }

    function whenIPress(key: string, modifiers: { shift: boolean } = { shift: false }): void {
      lastKey = new KeyboardEvent('keydown', { key, shiftKey: modifiers.shift, bubbles: true, cancelable: true });
      document.activeElement!.dispatchEvent(lastKey);
      fixture.detectChanges();
    }

    async function whenIPressEscape(): Promise<void> {
      whenIPress('Escape');
      await settle(fixture);
    }

    function thenTheKeyWasTrapped(): void {
      expect(lastKey.defaultPrevented).toBe(true);
    }

    function thenFocusIsOnThePageDropZone(): void {
      expect(document.activeElement).toBe(page().querySelector('[role="dialog"] [aria-label="Upload chapter pages or archive"]'));
    }

    function thenFocusIsOnTheLastDialogButton(): void {
      expect(document.activeElement).toBe(lastDialogButton());
    }

    function thenFocusIsBackOnTheSubmitButton(): void {
      expect(document.activeElement).toBe(trigger);
    }

    function lastDialogButton(): HTMLButtonElement {
      const buttons = page().querySelectorAll<HTMLButtonElement>('[role="dialog"] button');
      return buttons[buttons.length - 1];
    }
  });

  async function givenIOpenTheBoard(project: ScanlationProject): Promise<void> {
    await settle(fixture);
    http.expectOne(`${API}/scanlation/projects/${project.id}`).flush(ok(project));
    await settle(fixture);
    // The page-reports panel has its own spec.
    http.match(`${API}/scanlation/projects/${project.id}/page-reports`).forEach((r) => r.flush(ok([])));
    await settle(fixture);
  }

  async function whenTheProjectFailsToLoad(failure: { status: 0 | 404 }): Promise<void> {
    await settle(fixture);
    const request = http.expectOne(`${API}/scanlation/projects/${PROJECT_ID}`);
    if (failure.status === 404) {
      request.flush(fail('Project not found'), { status: 404, statusText: 'Not Found' });
    } else {
      request.error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });
    }
    await settle(fixture);
  }

  async function whenIRetryAndTheProjectLoads(project: ScanlationProject): Promise<void> {
    retryButton()!.click();
    await givenIOpenTheBoard(project);
  }

  async function whenIClaim(task: WorkflowTask, answer: { assignedTo: string }): Promise<void> {
    taskButton(task, '.btn-claim').click();
    lastRequest = http.expectOne(`${TASKS_URL}/${task.id}/claim`);
    lastRequest.flush(ok({ ...task, status: 'IN_PROGRESS', assigneeId: answer.assignedTo }));
    await settle(fixture);
  }

  async function whenIOpenTheSubmitDialogFor(task: WorkflowTask): Promise<void> {
    taskInDialog = task;
    taskButton(task, '.btn-submit').click();
    // The dialog is a @defer block: its code loads on first open.
    await settle(fixture);
  }

  async function whenIAddPages(...names: string[]): Promise<void> {
    choosePageFiles(page(), names);
    await settle(fixture);
  }

  async function whenISubmitTheDialog(): Promise<void> {
    page().querySelector('form.submit-dialog')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await settle(fixture);
  }

  /** Answers the page uploads in order: each one stored as `k<n>`, or refused by the server. */
  async function whenThePagesUpload(answers: ('ok' | 'fails')[]): Promise<void> {
    pageUploads = uploads();
    pageUploads.forEach((request, i) =>
      answers[i] === 'ok'
        ? request.flush(ok({ storageKey: `k${i + 1}`, cdnUrl: `https://cdn/k${i + 1}`, liteCdnUrl: null }))
        : request.flush(fail('Storage is down'), { status: 500, statusText: 'Server Error' })
    );
    await settle(fixture);
  }

  async function whenTheServerMovesTheTaskTo(stage: WorkflowTask['stage']): Promise<void> {
    lastRequest = http.expectOne(`${TASKS_URL}/${taskInDialog.id}/submit`);
    lastRequest.flush(ok({ ...taskInDialog, stage, status: 'PENDING', assigneeId: null }));
    await settle(fixture);
  }

  async function whenIPublishButItIsRefused(task: WorkflowTask, error: string): Promise<void> {
    taskButton(task, '.btn-publish').click();
    http.expectOne(`${TASKS_URL}/${task.id}/publish`).flush(fail(error), { status: 400, statusText: 'Bad Request' });
    await settle(fixture);
  }

  async function whenIPublish(task: WorkflowTask): Promise<void> {
    taskButton(task, '.btn-publish').click();
    http.expectOne(`${TASKS_URL}/${task.id}/publish`).flush(ok('Chapter published successfully'));
    await settle(fixture);
  }

  async function whenISwitchToProject(projectId: string): Promise<void> {
    fixture.componentRef.setInput('projectId', projectId);
    await settle(fixture);
  }

  async function whenTheProjectIsNotFound(projectId: string): Promise<void> {
    http.expectOne(`${API}/scanlation/projects/${projectId}`).flush(fail('not found'), { status: 404, statusText: 'Not Found' });
    await settle(fixture);
  }

  function thenTheTitleShows(title: string): void {
    expect(page().querySelector('h1')?.textContent).toContain(title);
  }

  function thenColumnHasTasks(stage: string, count: number): void {
    expect(column(stage).length).toBe(count);
  }

  function thenTheBoardHasTasks(count: number): void {
    expect(page().querySelectorAll('.task-card').length).toBe(count);
  }

  function thenISeeClaimButtons(count: number): void {
    expect(page().querySelectorAll('.btn-claim').length).toBe(count);
  }

  function thenISeeSubmitButtons(count: number): void {
    expect(page().querySelectorAll('.btn-submit').length).toBe(count);
  }

  function thenISeePublishButtons(count: number): void {
    expect(page().querySelectorAll('.btn-publish').length).toBe(count);
  }

  function thenTheRequestWasAPost(): void {
    expect(lastRequest.request.method).toBe('POST');
  }

  /** Identity is taken from the JWT: no userId in the body. */
  function thenTheRequestCarriesNoIdentity(): void {
    expect(lastRequest.request.body).toEqual({});
  }

  function thenTaskCardShows(stage: string, position: number, text: string): void {
    expect(column(stage)[position - 1].textContent).toContain(text);
  }

  function thenTheSubmitDialogIsOpen(): void {
    expect(page().querySelector('[role="dialog"]')).not.toBeNull();
  }

  function thenTheSubmitDialogIsClosed(): void {
    expect(page().querySelector('[role="dialog"]')).toBeNull();
  }

  function thenNothingWasSubmittedFor(task: WorkflowTask): void {
    http.expectNone(`${TASKS_URL}/${task.id}/submit`);
  }

  function thenTheSubmissionWas(pages: PagePayload[]): void {
    expect(lastRequest.request.body).toEqual({ pages });
  }

  function thenThePagesWentToTheFolder(folder: string): void {
    expect(pageUploads[0].request.urlWithParams).toContain(`folder=${encodeURIComponent(folder)}`);
  }

  /** In the last round of uploads: a page already uploaded is not sent again. */
  function thenThisManyPagesWereUploaded(count: number): void {
    expect(pageUploads.length).toBe(count);
  }

  function thenTheTaskLinksToItsPages(task: WorkflowTask, hrefs: string[]): void {
    const card = taskCard(task);
    expect(Array.from(card.querySelectorAll('.task-pages a')).map((a) => a.getAttribute('href'))).toEqual(hrefs);
  }

  function uploadedPage(pageNumber: number, key: string): PagePayload {
    return { pageNumber, storageKey: key, cdnUrl: `https://cdn/${key}`, width: 800, height: 1200 };
  }

  function thenThereIsAnUploadStudioLink(): void {
    expect(uploadLink()).not.toBeNull();
  }

  function thenTheUploadStudioLinkPointsTo(href: string): void {
    expect(uploadLink()!.getAttribute('href')).toBe(href);
  }

  function thenTheUploadStudioLinkReads(text: string): void {
    expect(uploadLink()!.textContent).toContain(text);
  }

  function thenISeeTheError(text: string): void {
    expect(page().querySelector('[role="alert"]')?.textContent).toContain(text);
  }

  function thenICanRetry(possible: boolean): void {
    expect(retryButton() !== undefined).toBe(possible);
  }

  function thenICanSee(text: string): void {
    expect(page().textContent).toContain(text);
  }

  function thenICannotSee(text: string): void {
    expect(page().textContent).not.toContain(text);
  }

  function page(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function retryButton(): HTMLButtonElement | undefined {
    return Array.from(page().querySelectorAll<HTMLButtonElement>('[role="alert"] button')).find((b) => b.textContent?.trim() === 'Retry');
  }

  /** Task cards shown in one column of the board. */
  function column(stage: string): HTMLElement[] {
    return Array.from(page().querySelectorAll<HTMLElement>(`section[data-stage="${stage}"] .task-card`));
  }

  function taskCard(task: WorkflowTask): HTMLElement {
    return column(task.stage).find((c) => c.querySelector('strong')?.textContent === `Chapter ${task.chapterNumber}`)!;
  }

  function taskButton(task: WorkflowTask, selector: string): HTMLButtonElement {
    return taskCard(task).querySelector<HTMLButtonElement>(selector)!;
  }

  function uploads(): TestRequest[] {
    return http.match((r) => r.url.startsWith(`${API}/storage/upload`));
  }

  function uploadLink(): HTMLAnchorElement | null {
    return page().querySelector<HTMLAnchorElement>('.btn-upload');
  }
});
