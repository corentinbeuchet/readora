import {
  MyTeam,
  ScanlationRole,
  TaskStatus,
  WorkflowStage,
  WorkflowTask,
  canClaim,
  canPublish,
  canSubmit,
  isAssignedTo,
  leadsTeam,
  publishesForTeam
} from '@app/core/models/scanlation';

describe('scanlation task rules', () => {
  let task: WorkflowTask;

  it.each<[WorkflowStage, TaskStatus, string | null, boolean]>([
    ['RAW_UPLOADED', 'PENDING', null, true],
    ['CLEANING', 'IN_PROGRESS', 'alice', false],
    ['TRANSLATING', 'COMPLETED', null, false],
    ['PUBLISHED', 'PENDING', null, false]
  ])('a %s task that is %s and held by %s can be claimed by a leader: %s', (stage, status, assigneeId, claimable) => {
    givenATask({ stage, status, assigneeId });

    thenICanClaimIt(claimable, ['LEADER']);
  });

  it.each<[WorkflowStage, ScanlationRole, boolean]>([
    ['RAW_UPLOADED', 'CLEANER_REDRAWER', true],
    ['TRANSLATING', 'TRANSLATOR', true],
    ['TRANSLATING', 'CLEANER_REDRAWER', false],
    ['QC_REVIEW', 'QUALITY_CHECKER', true],
    ['QC_REVIEW', 'PROOFREADER', false]
  ])('an open %s task can be claimed by a %s: %s', (stage, role, claimable) => {
    givenATask({ stage });

    thenICanClaimIt(claimable, [role]);
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
  ])('a %s task can be published by a quality checker: %s', (stage, publishable) => {
    givenATask({ stage });

    thenICanPublishIt(publishable, ['QUALITY_CHECKER']);
  });

  it('a translator cannot publish a task in QC review', () => {
    givenATask({ stage: 'QC_REVIEW' });

    thenICanPublishIt(false, ['TRANSLATOR']);
  });

  it('an unassigned task belongs to nobody, even a signed-out user', () => {
    givenATask({ assigneeId: null });

    thenItIsAssignedTo(null, false);
  });

  function givenATask(overrides: Partial<WorkflowTask>): void {
    task = { id: 't1', chapterNumber: '10', stage: 'RAW_UPLOADED', status: 'PENDING', assigneeId: null, pageCount: 20, pages: [], updatedAt: '2026-09-13T00:00:00Z', ...overrides };
  }

  function thenICanClaimIt(expected: boolean, myRoles: ScanlationRole[]): void {
    expect(canClaim(task, myRoles)).toBe(expected);
  }

  function thenCanSubmitIt(userId: string | null, expected: boolean): void {
    expect(canSubmit(task, userId)).toBe(expected);
  }

  function thenICanPublishIt(expected: boolean, myRoles: ScanlationRole[]): void {
    expect(canPublish(task, myRoles)).toBe(expected);
  }

  function thenItIsAssignedTo(userId: string | null, expected: boolean): void {
    expect(isAssignedTo(task, userId)).toBe(expected);
  }
});

describe('team rules', () => {
  let team: MyTeam;

  it.each<[ScanlationRole[], boolean]>([
    [['LEADER'], true],
    [['TRANSLATOR', 'LEADER'], true],
    [['TRANSLATOR', 'QUALITY_CHECKER'], false],
    [[], false]
  ])('with the roles %s I lead the team: %s', (myRoles, leads) => {
    givenMyRolesAre(myRoles);

    thenILeadTheTeam(leads);
  });

  it.each<[ScanlationRole[], boolean]>([
    [['LEADER'], true],
    [['QUALITY_CHECKER'], true],
    [['TRANSLATOR', 'PROOFREADER'], false]
  ])('with the roles %s I publish the chapters of the team: %s', (myRoles, publishes) => {
    givenMyRolesAre(myRoles);

    thenIPublishForTheTeam(publishes);
  });

  function thenIPublishForTheTeam(publishes: boolean): void {
    expect(publishesForTeam(team)).toBe(publishes);
  }

  function givenMyRolesAre(myRoles: ScanlationRole[]): void {
    team = { id: 't-1', name: 'Moon Scans', description: null, myRoles, boards: [] };
  }

  function thenILeadTheTeam(leads: boolean): void {
    expect(leadsTeam(team)).toBe(leads);
  }
});
