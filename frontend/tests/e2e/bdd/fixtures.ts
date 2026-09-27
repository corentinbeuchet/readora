import { mergeTests } from '@playwright/test';
import { test as bddTest } from 'playwright-bdd';
import { test as readoraTest } from '../support/fixtures';
import { PublishingTeam } from '../support/helpers';

/**
 * What a scenario named, mapped to what its steps created. Scenarios speak of "Solo Leveling" or "Moon Scans"; the
 * steps create a fresh series and use the e2e teams instead (tests never depend on seed data), and later steps find
 * them here by the scenario's names.
 */
export class Story {
  private readonly seriesByName = new Map<string, { workId: string; title: string }>();
  private readonly teamsByName = new Map<string, PublishingTeam>();

  addSeries(name: string, series: { workId: string; title: string }): void {
    this.seriesByName.set(name, series);
  }

  addTeam(name: string, team: PublishingTeam): void {
    this.teamsByName.set(name, team);
  }

  series(name: string): { workId: string; title: string } {
    return this.named(this.seriesByName, name, 'series');
  }

  team(name: string): PublishingTeam {
    return this.named(this.teamsByName, name, 'team');
  }

  private named<T>(entries: Map<string, T>, name: string, kind: string): T {
    const entry = entries.get(name);
    if (!entry) {
      throw new Error(`No ${kind} "${name}" in this scenario: a Given step must create it first.`);
    }
    return entry;
  }
}

/** Readora's fixtures, the ones playwright-bdd runs scenarios with, and a fresh `story` per scenario. */
export const test = mergeTests(readoraTest, bddTest).extend<{ story: Story }>({
  // eslint-disable-next-line no-empty-pattern -- Playwright reads a fixture's dependencies from this pattern: none here.
  story: async ({}, use) => {
    await use(new Story());
  }
});
