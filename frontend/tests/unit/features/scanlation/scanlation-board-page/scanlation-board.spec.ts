import { ScanlationProject, TaskStatus, WorkflowStage, WorkflowTask } from '@app/core/models/scanlation';
import { STAGES, tasksByStage, withTask, withTaskStage } from '@app/features/scanlation/scanlation-board-page/scanlation-board';

const PROJECT: ScanlationProject = {
  id: 'proj-1-uuid',
  name: 'FlameScans Solo Leveling',
  workId: 'work-1-uuid',
  teamId: 'team-1',
  teamName: 'Shadow Scans',
  boardEnabled: true,
  members: [{ userId: 'Alice', username: 'alice', roles: ['CLEANER_REDRAWER'] }],
  tasks: [
    { id: 't1', chapterNumber: '10', stage: 'RAW_UPLOADED', status: 'PENDING', assigneeId: null, assigneeUsername: null, pageCount: 22, pages: [], updatedAt: '2026-09-13T00:00:00Z' },
    { id: 't2', chapterNumber: '11', stage: 'CLEANING', status: 'IN_PROGRESS', assigneeId: null, assigneeUsername: null, pageCount: 20, pages: [], updatedAt: '2026-09-13T00:00:00Z' }
  ]
};

describe('scanlation board helpers', () => {
  let board: Record<WorkflowStage, WorkflowTask[]>;
  let project: ScanlationProject;

  it('groups tasks by stage, with every stage present', () => {
    whenIGroupTheTasksOf(PROJECT);

    thenTheColumnsAreEveryStage();
    thenTheColumnHolds('RAW_UPLOADED', ['t1']);
    thenTheColumnHolds('CLEANING', ['t2']);

    whenIGroupTheTasksOf(null);

    thenTheColumnHolds('TRANSLATING', []);
  });

  it('replaces a task with the API version, or appends a new one, without mutating', () => {
    whenTheApiReturnsTheTask(PROJECT, { ...PROJECT.tasks[0], stage: 'CLEANING', status: 'IN_PROGRESS', assigneeId: 'user-1' });

    thenTheTaskInColumnIsAssignedTo('CLEANING', 't1', 'user-1');
    thenTheOriginalTaskIsUnassigned('t1');

    whenTheApiReturnsTheTask(PROJECT, { id: 't3', chapterNumber: '12', stage: 'RAW_UPLOADED', status: 'PENDING', assigneeId: null, assigneeUsername: null, pageCount: 18, pages: [], updatedAt: '' });

    thenTheProjectTasksAre(['t1', 't2', 't3']);
  });

  it('moves a task to another stage', () => {
    whenIMoveTheTask('t1', 'PUBLISHED', 'COMPLETED', new Date('2026-09-19T10:00:00Z'));

    thenTheTaskIs('t1', { stage: 'PUBLISHED', status: 'COMPLETED', updatedAt: '2026-09-19T10:00:00.000Z' });
    thenTheOriginalTaskStageIs('t1', 'RAW_UPLOADED');
  });

  function whenIGroupTheTasksOf(source: ScanlationProject | null): void {
    board = tasksByStage(source);
  }

  function whenTheApiReturnsTheTask(source: ScanlationProject, task: WorkflowTask): void {
    project = withTask(source, task);
  }

  function whenIMoveTheTask(taskId: string, stage: WorkflowStage, status: TaskStatus, at: Date): void {
    project = withTaskStage(PROJECT, taskId, stage, status, at);
  }

  function thenTheColumnsAreEveryStage(): void {
    expect(Object.keys(board)).toEqual(STAGES.map((s) => s.key));
  }

  function thenTheColumnHolds(stage: WorkflowStage, taskIds: string[]): void {
    expect(board[stage].map((t) => t.id)).toEqual(taskIds);
  }

  function thenTheTaskInColumnIsAssignedTo(stage: WorkflowStage, taskId: string, assigneeId: string): void {
    expect(tasksByStage(project)[stage].find((t) => t.id === taskId)?.assigneeId).toBe(assigneeId);
  }

  function thenTheOriginalTaskIsUnassigned(taskId: string): void {
    expect(PROJECT.tasks.find((t) => t.id === taskId)?.assigneeId).toBeNull();
  }

  function thenTheProjectTasksAre(taskIds: string[]): void {
    expect(project.tasks.map((t) => t.id)).toEqual(taskIds);
  }

  function thenTheTaskIs(taskId: string, expected: Partial<WorkflowTask>): void {
    expect(project.tasks.find((t) => t.id === taskId)).toMatchObject(expected);
  }

  function thenTheOriginalTaskStageIs(taskId: string, stage: WorkflowStage): void {
    expect(PROJECT.tasks.find((t) => t.id === taskId)?.stage).toBe(stage);
  }
});
