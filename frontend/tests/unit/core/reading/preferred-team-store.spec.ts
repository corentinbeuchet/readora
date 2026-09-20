import { TestBed } from '@angular/core/testing';
import { PREFERRED_TEAMS_KEY, PreferredTeamStore } from '@app/core/reading/preferred-team-store';
import { BrowserStorage } from '@app/core/storage/browser-storage';
import { MemoryStorage } from '../../test-utils';

describe('PreferredTeamStore (US-12)', () => {
  let storage: MemoryStorage;
  let store: PreferredTeamStore;

  it('has no team for a series until one is chosen, then keeps it across visits', () => {
    givenTheBrowserRemembers(null);

    thenMyTeamFor('w-1', null);

    whenIChooseTheTeam('w-1', 't-moon');

    thenMyTeamFor('w-1', 't-moon');
    thenTheBrowserRemembers({ 'w-1': 't-moon' });
  });

  it('restores my teams from the browser', () => {
    givenTheBrowserRemembers({ 'w-1': 't-moon', 'w-2': 't-shadow' });

    thenMyTeamFor('w-2', 't-shadow');
  });

  it('ignores stored data that is not a team id per series', () => {
    givenTheBrowserRemembers({ 'w-1': 't-moon', 'w-2': 42, 'w-3': null });

    thenMyTeamFor('w-1', 't-moon');
    thenMyTeamFor('w-2', null);
  });

  it('keeps the 200 most recent series', () => {
    givenTheBrowserRemembers(Object.fromEntries(Array.from({ length: 200 }, (_, i) => [`w-${i}`, 't-moon'])));

    whenIChooseTheTeam('w-new', 't-shadow');

    thenMyTeamFor('w-0', null);
    thenMyTeamFor('w-1', 't-moon');
    thenMyTeamFor('w-new', 't-shadow');
  });

  function givenTheBrowserRemembers(teams: unknown): void {
    storage = new MemoryStorage();
    if (teams !== null) {
      storage.write(PREFERRED_TEAMS_KEY, teams);
    }
    TestBed.configureTestingModule({ providers: [{ provide: BrowserStorage, useValue: storage }] });
    store = TestBed.inject(PreferredTeamStore);
  }

  function whenIChooseTheTeam(workId: string, teamId: string): void {
    store.remember(workId, teamId);
  }

  function thenMyTeamFor(workId: string, teamId: string | null): void {
    expect(store.teamFor(workId)).toBe(teamId);
  }

  function thenTheBrowserRemembers(teams: Record<string, string>): void {
    expect(storage.read(PREFERRED_TEAMS_KEY)).toEqual(teams);
  }
});
