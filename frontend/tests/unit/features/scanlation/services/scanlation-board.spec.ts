import { ScanlationProject } from '@app/core/models/readora.models';
import { STAGES, tasksByStage, withTask, withTaskStage } from '@app/features/scanlation/services/scanlation-board';

const PROJECT: ScanlationProject = {
  id: 'proj-1-uuid',
  name: 'FlameScans Solo Leveling',
  workId: 'work-1-uuid',
  members: [{ userId: 'Alice', roles: ['CLEANER_REDRAWER'] }],
  tasks: [
    { id: 't1', chapterNumber: '10', stage: 'RAW_UPLOADED', status: 'PENDING', pageCount: 22, updatedAt: '2026-09-13T00:00:00Z' },
    { id: 't2', chapterNumber: '11', stage: 'CLEANING', status: 'IN_PROGRESS', pageCount: 20, updatedAt: '2026-09-13T00:00:00Z' }
  ]
};

describe('scanlation board helpers', () => {
  it('groups tasks by stage, with every stage present', () => {
    const stages = tasksByStage(PROJECT);
    expect(Object.keys(stages)).toEqual(STAGES.map((s) => s.key));
    expect(stages.RAW_UPLOADED.map((t) => t.id)).toEqual(['t1']);
    expect(stages.CLEANING.map((t) => t.id)).toEqual(['t2']);
    expect(tasksByStage(null).TRANSLATING).toEqual([]);
  });

  it('replaces a task with the API version, or appends a new one, without mutating', () => {
    const claimed = withTask(PROJECT, { ...PROJECT.tasks[0], stage: 'CLEANING', status: 'IN_PROGRESS', assigneeId: 'user-1' });
    expect(tasksByStage(claimed).CLEANING.find((t) => t.id === 't1')?.assigneeId).toBe('user-1');
    expect(PROJECT.tasks[0].assigneeId).toBeUndefined();

    const added = withTask(PROJECT, { id: 't3', chapterNumber: '12', stage: 'RAW_UPLOADED', status: 'PENDING', pageCount: 18, updatedAt: '' });
    expect(added.tasks.map((t) => t.id)).toEqual(['t1', 't2', 't3']);
  });

  it('moves a task to another stage', () => {
    const moved = withTaskStage(PROJECT, 't1', 'PUBLISHED', 'COMPLETED', new Date('2026-09-19T10:00:00Z'));
    expect(moved.tasks[0]).toMatchObject({ stage: 'PUBLISHED', status: 'COMPLETED', updatedAt: '2026-09-19T10:00:00.000Z' });
    expect(PROJECT.tasks[0].stage).toBe('RAW_UPLOADED');
  });
});
