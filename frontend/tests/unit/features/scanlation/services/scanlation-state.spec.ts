import { TestBed } from '@angular/core/testing';
import { ScanlationState } from '@app/features/scanlation/services/scanlation-state';
import { ScanlationProject } from '@app/core/models/readora.models';

const MOCK_PROJECT: ScanlationProject = {
  id: 'proj-1-uuid',
  name: 'FlameScans Solo Leveling',
  workId: 'work-1-uuid',
  members: [
    { userId: 'Alice', roles: ['CLEANER_REDRAWER'] },
    { userId: 'Bob', roles: ['TRANSLATOR'] }
  ],
  tasks: [
    { id: 't1', chapterNumber: '10', stage: 'RAW_UPLOADED', status: 'PENDING', pageCount: 22, updatedAt: '2026-09-13T00:00:00Z' },
    { id: 't2', chapterNumber: '11', stage: 'CLEANING', status: 'IN_PROGRESS', pageCount: 20, updatedAt: '2026-09-13T00:00:00Z' }
  ]
};

describe('ScanlationState (Signals)', () => {
  let service: ScanlationState;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ScanlationState]
    });
    service = TestBed.inject(ScanlationState);
  });

  it('should categorize tasks by stage dynamically using computed signal', () => {
    service.setProject(MOCK_PROJECT);

    const stages = service.tasksByStage();
    expect(stages.RAW_UPLOADED.length).toBe(1);
    expect(stages.CLEANING.length).toBe(1);
    expect(stages.TRANSLATING.length).toBe(0);
  });

  it('should update task stage and recalculate computed signals', () => {
    service.setProject(MOCK_PROJECT);

    service.updateTaskStage('t1', 'TRANSLATING', 'PENDING');

    const stages = service.tasksByStage();
    expect(stages.RAW_UPLOADED.length).toBe(0);
    expect(stages.TRANSLATING.length).toBe(1);
    expect(stages.TRANSLATING[0].id).toBe('t1');
  });

  it('should replace a task with the version returned by the API (upsertTask)', () => {
    service.setProject(MOCK_PROJECT);

    service.upsertTask({ ...MOCK_PROJECT.tasks[0], stage: 'CLEANING', status: 'IN_PROGRESS', assigneeId: 'user-1' });

    const stages = service.tasksByStage();
    expect(stages.RAW_UPLOADED.length).toBe(0);
    expect(stages.CLEANING.length).toBe(2);
    expect(stages.CLEANING.find((t) => t.id === 't1')?.assigneeId).toBe('user-1');
    expect(service.currentProject()?.tasks.length).toBe(2);
  });

  it('should append unknown tasks and clear the project', () => {
    service.setProject(MOCK_PROJECT);
    service.upsertTask({ id: 't3', chapterNumber: '12', stage: 'RAW_UPLOADED', status: 'PENDING', pageCount: 18, updatedAt: '2026-09-13T00:00:00Z' });
    expect(service.currentProject()?.tasks.length).toBe(3);

    service.clear();
    expect(service.currentProject()).toBeNull();
    expect(service.tasksByStage().RAW_UPLOADED.length).toBe(0);
  });
});
