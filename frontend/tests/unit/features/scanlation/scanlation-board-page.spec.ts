import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController, TestRequest } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { ScanlationBoardPage } from '@app/features/scanlation/scanlation-board-page';
import { ScanlationProject, WorkflowTask } from '@app/core/models/readora.models';
import { givenIAmSignedInWith } from '../../core/auth/auth-fixtures';
import { API, fail, ok, provideHttpTesting, settle } from '../../test-utils';

const PROJECT_ID = 'proj-1';
const TASKS_URL = `${API}/scanlation/projects/${PROJECT_ID}/tasks`;

const RAW_TASK: WorkflowTask = { id: 't-raw', chapterNumber: '10', stage: 'RAW_UPLOADED', status: 'PENDING', pageCount: 22, updatedAt: '2026-09-13T00:00:00Z' };
const MY_TASK: WorkflowTask = { id: 't-mine', chapterNumber: '11', stage: 'CLEANING', status: 'IN_PROGRESS', assigneeId: 'user-1', pageCount: 20, updatedAt: '2026-09-13T00:00:00Z' };
const QC_TASK: WorkflowTask = { id: 't-qc', chapterNumber: '9', stage: 'QC_REVIEW', status: 'PENDING', pageCount: 18, updatedAt: '2026-09-13T00:00:00Z' };

const PROJECT: ScanlationProject = {
  id: PROJECT_ID,
  name: 'FlameScans Solo Leveling',
  workId: 'work-1',
  members: [{ userId: 'user-1', roles: ['CLEANER_REDRAWER', 'QUALITY_CHECKER'] }],
  tasks: [RAW_TASK, MY_TASK, QC_TASK]
};

describe('ScanlationBoardPage (API-driven, permission gated)', () => {
  let fixture: ComponentFixture<ScanlationBoardPage>;
  let http: HttpTestingController;
  let lastRequest: TestRequest;
  let taskInDialog: WorkflowTask;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ScanlationBoardPage],
      providers: [provideRouter([]), ...provideHttpTesting()]
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ScanlationBoardPage);
    fixture.componentRef.setInput('projectId', PROJECT_ID);
  });

  afterEach(() => http.verify());

  it('loads the project from the API and groups tasks by stage', async () => {
    await givenIAmSignedInWith(['PROJECT_VIEW']);
    await givenIOpenTheBoard(PROJECT);

    thenTheTitleShows('FlameScans Solo Leveling');
    thenColumnHasTasks('RAW_UPLOADED', 1);
    thenColumnHasTasks('QC_REVIEW', 1);
    thenTheBoardHasTasks(3);
  });

  it('a reader-like member with PROJECT_VIEW only sees no Claim / Submit / Publish buttons', async () => {
    await givenIAmSignedInWith(['PROJECT_VIEW']);
    await givenIOpenTheBoard(PROJECT);

    thenISeeClaimButtons(0);
    thenISeeSubmitButtons(0);
    thenISeePublishButtons(0);
  });

  it('a SCANLATOR sees Claim on unassigned tasks, Submit on their own task and Publish on QC tasks', async () => {
    await givenIAmSignedInWith(['PROJECT_VIEW', 'TASK_CLAIM', 'TASK_SUBMIT', 'CHAPTER_PUBLISH']);
    await givenIOpenTheBoard(PROJECT);

    thenISeeClaimButtons(2);
    thenISeeSubmitButtons(1);
    thenISeePublishButtons(1);
  });

  it('Claim calls the API and updates the board from the response', async () => {
    await givenIAmSignedInWith(['PROJECT_VIEW', 'TASK_CLAIM']);
    await givenIOpenTheBoard(PROJECT);

    await whenIClaim(RAW_TASK, { assignedTo: 'user-1' });

    thenTheRequestWasAPost();
    thenTheRequestCarriesNoIdentity();
    thenTaskCardShows('RAW_UPLOADED', 1, 'Assigned: ');
    thenICanSee('Assigned: you');
  });

  it('Submit opens a Signal Forms dialog, validates, then posts assetUrl/pageCount and advances the task', async () => {
    await givenIAmSignedInWith(['PROJECT_VIEW', 'TASK_SUBMIT']);
    await givenIOpenTheBoard(PROJECT);

    await whenIOpenTheSubmitDialogFor(MY_TASK);

    thenTheSubmitDialogIsOpen();

    await whenISubmitAnInvalidAssetUrl('not a url');

    thenICanSee('Must be an http(s) URL');
    thenNothingWasSubmittedFor(MY_TASK);

    await whenISubmitTheAssetUrl('https://cdn.readora.com/packages/ch11.zip', { advancedTo: 'TRANSLATING' });

    thenTheSubmissionWas({ assetUrl: 'https://cdn.readora.com/packages/ch11.zip', pageCount: 20 });
    thenTheSubmitDialogIsClosed();
    thenColumnHasTasks('TRANSLATING', 1);
    thenColumnHasTasks('CLEANING', 0);
  });

  it('Publish calls the API and moves the task to PUBLISHED; API errors are shown', async () => {
    await givenIAmSignedInWith(['PROJECT_VIEW', 'CHAPTER_PUBLISH']);
    await givenIOpenTheBoard(PROJECT);

    await whenIPublishButItIsRefused(QC_TASK, 'User is not a member of this project');

    thenISeeTheError('not a member');
    thenColumnHasTasks('QC_REVIEW', 1);

    await whenIPublish(QC_TASK);

    thenColumnHasTasks('PUBLISHED', 1);
    thenColumnHasTasks('QC_REVIEW', 0);
  });

  it('Upload Studio link is rendered and points to /upload for users with WORK_CREATE permission', async () => {
    await givenIAmSignedInWith(['PROJECT_VIEW', 'WORK_CREATE']);
    await givenIOpenTheBoard(PROJECT);

    thenThereIsAnUploadStudioLink();
    thenTheUploadStudioLinkPointsTo('/upload');
    thenTheUploadStudioLinkReads('Upload Studio');
  });

  it('does not show the previous project while another one loads or when it fails', async () => {
    await givenIAmSignedInWith(['PROJECT_VIEW']);
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

      thenFocusIsOnTheAssetUrlField();

      whenIFocusTheLastDialogButton();
      whenIPress('Tab');

      thenTheKeyWasTrapped();
      thenFocusIsOnTheAssetUrlField();

      whenIPress('Tab', { shift: true });

      thenTheKeyWasTrapped();
      thenFocusIsOnTheLastDialogButton();

      await whenIPressEscape();

      thenTheSubmitDialogIsClosed();
      thenFocusIsBackOnTheSubmitButton();
    });

    async function givenTheSubmitDialogIsOpenFromItsButton(task: WorkflowTask): Promise<void> {
      await givenIAmSignedInWith(['PROJECT_VIEW', 'TASK_SUBMIT']);
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

    function thenFocusIsOnTheAssetUrlField(): void {
      expect(document.activeElement).toBe(page().querySelector('#submit-asset-url'));
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

  async function whenISubmitAnInvalidAssetUrl(url: string): Promise<void> {
    await typeAndSubmitAssetUrl(url);
  }

  async function whenISubmitTheAssetUrl(url: string, answer: { advancedTo: WorkflowTask['stage'] }): Promise<void> {
    await typeAndSubmitAssetUrl(url);
    lastRequest = http.expectOne(`${TASKS_URL}/${taskInDialog.id}/submit`);
    lastRequest.flush(ok({ ...taskInDialog, stage: answer.advancedTo, status: 'PENDING', assigneeId: undefined, assetPackageUrl: url }));
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

  function thenTheSubmissionWas(body: { assetUrl: string; pageCount: number }): void {
    expect(lastRequest.request.body).toEqual(body);
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

  function thenICanSee(text: string): void {
    expect(page().textContent).toContain(text);
  }

  function thenICannotSee(text: string): void {
    expect(page().textContent).not.toContain(text);
  }

  async function typeAndSubmitAssetUrl(url: string): Promise<void> {
    const field = page().querySelector<HTMLInputElement>('#submit-asset-url')!;
    field.value = url;
    field.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    page().querySelector('form.submit-dialog')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await settle(fixture);
  }

  function page(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  /** Task cards shown in one column of the board. */
  function column(stage: string): HTMLElement[] {
    return Array.from(page().querySelectorAll<HTMLElement>(`section[data-stage="${stage}"] .task-card`));
  }

  function taskButton(task: WorkflowTask, selector: string): HTMLButtonElement {
    const card = column(task.stage).find((c) => c.querySelector('strong')?.textContent === `Chapter ${task.chapterNumber}`)!;
    return card.querySelector<HTMLButtonElement>(selector)!;
  }

  function uploadLink(): HTMLAnchorElement | null {
    return page().querySelector<HTMLAnchorElement>('.btn-upload');
  }
});
