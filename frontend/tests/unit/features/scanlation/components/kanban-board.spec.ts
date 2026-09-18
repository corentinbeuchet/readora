import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { KanbanBoard } from '@app/features/scanlation/components/kanban-board';
import { ScanlationState } from '@app/features/scanlation/services/scanlation-state';
import { AuthStore } from '@app/core/auth/auth-store';
import { ScanlationProject } from '@app/core/models/readora.models';
import { environment } from '../../../../../src/environments/environment';
import { mockUser, signIn } from '../../../core/auth/auth-fixtures';
import { settle } from '../../../test-utils';

const API = environment.apiUrl;
const PROJECT_ID = 'proj-1';

const PROJECT: ScanlationProject = {
  id: PROJECT_ID,
  name: 'FlameScans Solo Leveling',
  workId: 'work-1',
  members: [{ userId: 'user-1', roles: ['CLEANER_REDRAWER', 'QUALITY_CHECKER'] }],
  tasks: [
    { id: 't-raw', chapterNumber: '10', stage: 'RAW_UPLOADED', status: 'PENDING', pageCount: 22, updatedAt: '2026-09-13T00:00:00Z' },
    { id: 't-mine', chapterNumber: '11', stage: 'CLEANING', status: 'IN_PROGRESS', assigneeId: 'user-1', pageCount: 20, updatedAt: '2026-09-13T00:00:00Z' },
    { id: 't-qc', chapterNumber: '9', stage: 'QC_REVIEW', status: 'PENDING', pageCount: 18, updatedAt: '2026-09-13T00:00:00Z' }
  ]
};

describe('KanbanBoard (API-driven, permission gated)', () => {
  let fixture: ComponentFixture<KanbanBoard>;
  let http: HttpTestingController;
  let store: AuthStore;
  let state: ScanlationState;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [KanbanBoard],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()]
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    store = TestBed.inject(AuthStore);
    fixture = TestBed.createComponent(KanbanBoard);
    state = fixture.debugElement.injector.get(ScanlationState);
    fixture.componentRef.setInput('projectId', PROJECT_ID);
  });

  afterEach(() => http.verify());

  async function render(): Promise<void> {
    await settle(fixture);
    http.expectOne(`${API}/scanlation/projects/${PROJECT_ID}`).flush({ success: true, data: PROJECT, error: null });
    await settle(fixture);
  }

  async function submitDialog(): Promise<void> {
    q('form.submit-dialog')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await settle(fixture);
  }

  const all = (selector: string): HTMLElement[] => Array.from(fixture.nativeElement.querySelectorAll(selector));
  const q = (selector: string): HTMLElement | null => fixture.nativeElement.querySelector(selector);

  it('loads the project from the API and groups tasks by stage', async () => {
    await signIn(store, http, mockUser({ permissions: ['PROJECT_VIEW'] }));
    await render();

    expect(q('h1')?.textContent).toContain('FlameScans Solo Leveling');
    expect(state.tasksByStage().RAW_UPLOADED.length).toBe(1);
    expect(state.tasksByStage().QC_REVIEW.length).toBe(1);
    expect(all('.task-card').length).toBe(3);
  });

  it('a reader-like member with PROJECT_VIEW only sees no Claim / Submit / Publish buttons', async () => {
    await signIn(store, http, mockUser({ permissions: ['PROJECT_VIEW'] }));
    await render();

    expect(all('.btn-claim').length).toBe(0);
    expect(all('.btn-submit').length).toBe(0);
    expect(all('.btn-publish').length).toBe(0);
  });

  it('a SCANLATOR sees Claim on unassigned tasks, Submit on their own task and Publish on QC tasks', async () => {
    await signIn(store, http, mockUser({ permissions: ['PROJECT_VIEW', 'TASK_CLAIM', 'TASK_SUBMIT', 'CHAPTER_PUBLISH'] }));
    await render();

    expect(all('.btn-claim').length).toBe(2); // t-raw and t-qc are unassigned
    expect(all('.btn-submit').length).toBe(1); // t-mine
    expect(all('.btn-publish').length).toBe(1); // t-qc
  });

  it('Claim calls the API and updates the board from the response', async () => {
    await signIn(store, http, mockUser({ permissions: ['PROJECT_VIEW', 'TASK_CLAIM'] }));
    await render();

    all('.btn-claim')[0].click();
    const req = http.expectOne(`${API}/scanlation/projects/${PROJECT_ID}/tasks/t-raw/claim`);
    expect(req.request.method).toBe('POST');
    // Identity is taken from the JWT: no userId in the body.
    expect(req.request.body).toEqual({});
    req.flush({ success: true, error: null, data: { ...PROJECT.tasks[0], status: 'IN_PROGRESS', assigneeId: 'user-1' } });
    await settle(fixture);

    expect(state.tasksByStage().RAW_UPLOADED[0].assigneeId).toBe('user-1');
    expect(fixture.nativeElement.textContent).toContain('Assigned: you');
  });

  it('Submit opens a Signal Forms dialog, validates, then posts assetUrl/pageCount and advances the task', async () => {
    await signIn(store, http, mockUser({ permissions: ['PROJECT_VIEW', 'TASK_SUBMIT'] }));
    await render();

    all('.btn-submit')[0].click();
    await settle(fixture); // the dialog is a @defer block: its code loads on first open
    expect(q('[role="dialog"]')).not.toBeNull();

    const url = q('#submit-asset-url') as HTMLInputElement;
    url.value = 'not a url';
    url.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await submitDialog();
    expect(fixture.nativeElement.textContent).toContain('Must be an http(s) URL');
    http.expectNone(`${API}/scanlation/projects/${PROJECT_ID}/tasks/t-mine/submit`);

    url.value = 'https://cdn.readora.com/packages/ch11.zip';
    url.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await submitDialog();

    const req = http.expectOne(`${API}/scanlation/projects/${PROJECT_ID}/tasks/t-mine/submit`);
    expect(req.request.body).toEqual({ assetUrl: 'https://cdn.readora.com/packages/ch11.zip', pageCount: 20 });
    req.flush({ success: true, error: null, data: { ...PROJECT.tasks[1], stage: 'TRANSLATING', status: 'PENDING', assigneeId: undefined, assetPackageUrl: 'https://cdn.readora.com/packages/ch11.zip' } });
    await settle(fixture);

    expect(q('[role="dialog"]')).toBeNull();
    expect(state.tasksByStage().TRANSLATING.length).toBe(1);
    expect(state.tasksByStage().CLEANING.length).toBe(0);
  });

  it('Publish calls the API and moves the task to PUBLISHED; API errors are shown', async () => {
    await signIn(store, http, mockUser({ permissions: ['PROJECT_VIEW', 'CHAPTER_PUBLISH'] }));
    await render();

    all('.btn-publish')[0].click();
    http.expectOne(`${API}/scanlation/projects/${PROJECT_ID}/tasks/t-qc/publish`).flush(
      { success: false, data: null, error: 'User is not a member of this project' },
      { status: 400, statusText: 'Bad Request' }
    );
    await settle(fixture);
    expect(q('[role="alert"]')?.textContent).toContain('not a member');
    expect(state.tasksByStage().QC_REVIEW.length).toBe(1);

    all('.btn-publish')[0].click();
    http.expectOne(`${API}/scanlation/projects/${PROJECT_ID}/tasks/t-qc/publish`).flush({ success: true, data: 'Chapter published successfully', error: null });
    await settle(fixture);
    expect(state.tasksByStage().PUBLISHED.length).toBe(1);
    expect(state.tasksByStage().QC_REVIEW.length).toBe(0);
  });

  it('Upload Studio link is rendered and points to /upload for users with WORK_CREATE permission', async () => {
    await signIn(store, http, mockUser({ permissions: ['PROJECT_VIEW', 'WORK_CREATE'] }));
    await render();

    const uploadLink = q('.btn-upload') as HTMLAnchorElement;
    expect(uploadLink).not.toBeNull();
    expect(uploadLink.getAttribute('href')).toBe('/upload');
    expect(uploadLink.textContent).toContain('Upload Studio');
  });

  it('does not show the previous project while another one loads or when it fails', async () => {
    await signIn(store, http, mockUser({ permissions: ['PROJECT_VIEW'] }));
    await render();
    expect(state.currentProject()?.id).toBe(PROJECT_ID);

    fixture.componentRef.setInput('projectId', 'proj-2');
    await settle(fixture);
    expect(state.currentProject()).toBeNull();
    expect(all('.task-card').length).toBe(0);

    http.expectOne(`${API}/scanlation/projects/proj-2`).flush({ success: false, data: null, error: 'not found' }, { status: 404, statusText: 'Not Found' });
    await settle(fixture);
    expect(state.currentProject()).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('FlameScans Solo Leveling');
  });

  it('gives every board its own state (not a root singleton)', () => {
    const other = TestBed.createComponent(KanbanBoard);
    expect(other.debugElement.injector.get(ScanlationState)).not.toBe(state);
    expect(() => TestBed.inject(ScanlationState)).toThrow();
  });

  describe('submit dialog accessibility', () => {
    const key = (target: Element, k: string, shiftKey = false): KeyboardEvent => {
      const event = new KeyboardEvent('keydown', { key: k, shiftKey, bubbles: true, cancelable: true });
      target.dispatchEvent(event);
      fixture.detectChanges();
      return event;
    };

    async function openDialog(): Promise<HTMLButtonElement> {
      await signIn(store, http, mockUser({ permissions: ['PROJECT_VIEW', 'TASK_SUBMIT'] }));
      await render();
      const trigger = all('.btn-submit')[0] as HTMLButtonElement;
      trigger.focus();
      trigger.click();
      await settle(fixture);
      return trigger;
    }

    it('moves focus into the dialog, traps Tab, closes on Escape and returns focus', async () => {
      const trigger = await openDialog();
      const dialog = q('[role="dialog"]')!;
      const first = q('#submit-asset-url')!;
      const buttons = Array.from(dialog.querySelectorAll('button')) as HTMLButtonElement[];
      const last = buttons[buttons.length - 1];

      expect(document.activeElement).toBe(first);

      last.focus();
      expect(key(last, 'Tab').defaultPrevented).toBe(true);
      expect(document.activeElement).toBe(first);

      expect(key(first, 'Tab', true).defaultPrevented).toBe(true);
      expect(document.activeElement).toBe(last);

      key(last, 'Escape');
      await settle(fixture);
      expect(q('[role="dialog"]')).toBeNull();
      expect(document.activeElement).toBe(trigger);
    });
  });
});
