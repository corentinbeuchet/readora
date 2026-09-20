import { ChapterGroup, ChapterSummary, TeamShare, groupByNumber, pickVersion, teamsOf } from '@app/core/models/chapter';

const SHADOW = { id: 't-shadow', name: 'Shadow Scans' };
const MOON = { id: 't-moon', name: 'Moon Scans' };
const SUN = { id: 't-sun', name: 'Sun Scans' };

describe('chapter versions (US-12)', () => {
  let chapters: ChapterSummary[];
  let groups: ChapterGroup[];
  let shares: TeamShare[];

  it('one group per chapter number, versions in the order of the list', () => {
    givenTheChapters([version('5', SHADOW), version('5', MOON), version('6', SHADOW)]);

    whenIGroupThemByNumber();

    thenTheGroupsAre([
      { number: '5', teams: ['Shadow Scans', 'Moon Scans'] },
      { number: '6', teams: ['Shadow Scans'] }
    ]);
  });

  it('an empty list has no group', () => {
    givenTheChapters([]);

    whenIGroupThemByNumber();

    thenTheGroupsAre([]);
  });

  it.each<[string, string | null, string]>([
    ['my team has a version', 't-moon', 'Moon Scans'],
    ['my team has none', 't-sun', 'Shadow Scans'],
    ['I have no team', null, 'Shadow Scans']
  ])('when %s, the version picked is by the right team', (_case, preferredTeamId, picked) => {
    givenTheChapters([version('5', SHADOW), version('5', MOON)]);

    thenThePickIs(preferredTeamId, picked);
  });

  it('nothing to pick from gives nothing', () => {
    givenTheChapters([]);

    thenThereIsNoPick();
  });

  it('teams are listed with their chapter count, the biggest first, then by name', () => {
    givenTheChapters([version('5', SUN), version('5', MOON), version('6', SHADOW), version('7', SHADOW)]);

    whenICountTheTeams();

    thenTheTeamsAre([
      ['Shadow Scans', 2],
      ['Moon Scans', 1],
      ['Sun Scans', 1]
    ]);
  });

  function givenTheChapters(list: ChapterSummary[]): void {
    chapters = list;
  }

  function whenIGroupThemByNumber(): void {
    groups = groupByNumber(chapters);
  }

  function whenICountTheTeams(): void {
    shares = teamsOf(chapters);
  }

  function thenTheGroupsAre(expected: { number: string; teams: string[] }[]): void {
    expect(groups.map((group) => ({ number: group.chapterNumber, teams: group.versions.map((v) => v.team.name) }))).toEqual(expected);
  }

  function thenThePickIs(preferredTeamId: string | null, team: string): void {
    expect(pickVersion(chapters, preferredTeamId)?.team.name).toBe(team);
  }

  function thenThereIsNoPick(): void {
    expect(pickVersion(chapters, 't-moon')).toBeUndefined();
  }

  function thenTheTeamsAre(expected: [string, number][]): void {
    expect(shares.map((share) => [share.team.name, share.chapterCount])).toEqual(expected);
  }

  function version(chapterNumber: string, team: { id: string; name: string }): ChapterSummary {
    return { id: `c-${chapterNumber}-${team.id}`, workId: 'w-1', chapterNumber, title: '', status: 'PUBLISHED', pageCount: 10, publishedAt: null, team };
  }
});
