import { TaskStatus, WorkflowStage, WorkflowTask, canClaim, canPublish, canSubmit, isAssignedTo } from '@app/core/models/scanlation';

describe('scanlation task rules', () => {
  let task: WorkflowTask;

  it.each<[WorkflowStage, TaskStatus, string | undefined, boolean]>([
    ['RAW_UPLOADED', 'PENDING', undefined, true],
    ['CLEANING', 'IN_PROGRESS', 'alice', false],
    ['TRANSLATING', 'COMPLETED', undefined, false],
    ['PUBLISHED', 'PENDING', undefined, false]
  ])('a %s task that is %s and held by %s can be claimed: %s', (stage, status, assigneeId, claimable) => {
    givenATask({ stage, status, assigneeId });

    thenICanClaimIt(claimable);
  });

  it.each<[WorkflowStage, string | null, boolean]>([
    ['CLEANING', 'alice', true],
    ['CLEANING', 'bob', false],
    ['CLEANING', null, false],
    ['QC_REVIEW', 'alice', false],
    ['PUBLISHED', 'alice', false]
  ])('a %s task held by alice can be submitted by %s: %s', (stage, userId, submittable) => {
    givenATask({ stage, assigneeId: 'alice' });

    thenCanSubmitIt(userId, submittable);
  });

  it.each<[WorkflowStage, boolean]>([
    ['QC_REVIEW', true],
    ['PROOFREADING', false],
    ['PUBLISHED', false]
  ])('a %s task can be published: %s', (stage, publishable) => {
    givenATask({ stage });

    thenICanPublishIt(publishable);
  });

  it('an unassigned task belongs to nobody, even a signed-out user', () => {
    givenATask({ assigneeId: undefined });

    thenItIsAssignedTo(null, false);
  });

  function givenATask(overrides: Partial<WorkflowTask>): void {
    task = { id: 't1', chapterNumber: '10', stage: 'RAW_UPLOADED', status: 'PENDING', pageCount: 20, updatedAt: '2026-09-13T00:00:00Z', ...overrides };
  }

  function thenICanClaimIt(expected: boolean): void {
    expect(canClaim(task)).toBe(expected);
  }

  function thenCanSubmitIt(userId: string | null, expected: boolean): void {
    expect(canSubmit(task, userId)).toBe(expected);
  }

  function thenICanPublishIt(expected: boolean): void {
    expect(canPublish(task)).toBe(expected);
  }

  function thenItIsAssignedTo(userId: string | null, expected: boolean): void {
    expect(isAssignedTo(task, userId)).toBe(expected);
  }
});
