import { WorkSummary } from '@app/core/models/catalog';
import { NewChaptersOfSeries, Release, groupNewChapters } from '@app/core/models/discovery';

const SOLO = work('w-solo');
const ORV = work('w-orv');

describe('groupNewChapters', () => {
  let groups: NewChaptersOfSeries[];

  it('makes one group per series, in the order of each series\' newest chapter', () => {
    whenIGroup([release(SOLO, '8'), release(ORV, '12'), release(SOLO, '7')]);

    thenTheGroupsAre([
      { series: 'w-solo', count: 2, first: '7' },
      { series: 'w-orv', count: 1, first: '12' }
    ]);
  });

  it('has no group without releases', () => {
    whenIGroup([]);

    thenTheGroupsAre([]);
  });

  function whenIGroup(releases: Release[]): void {
    groups = groupNewChapters(releases);
  }

  function thenTheGroupsAre(expected: { series: string; count: number; first: string }[]): void {
    expect(groups.map((g) => ({ series: g.work.id, count: g.count, first: g.first.chapterNumber }))).toEqual(expected);
  }
});

function work(id: string): WorkSummary {
  return { id, title: id, type: 'MANHWA', status: 'ONGOING', author: null, demographic: null, coverImageUrl: null, coverThumbnailUrl: null, genres: [] };
}

function release(series: WorkSummary, chapter: string): Release {
  return { work: series, team: { id: 't-1', name: 'Shadow Scans' }, chapterId: `c-${series.id}-${chapter}`, chapterNumber: chapter, chapterTitle: '', publishedAt: '2026-09-24T00:00:00Z', read: false };
}
