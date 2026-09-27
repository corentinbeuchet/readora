import { mergeTests } from '@playwright/test';
import { defineParameterType, test as bddTest } from 'playwright-bdd';
import { test as readoraTest } from '../support/fixtures';
import { Story } from './story';

/** A list of chapter numbers as scenarios write it: "5", "5 and 6", "1, 2 and 3". */
defineParameterType({
  name: 'chapters',
  regexp: /\d+(?:(?:, | and )\d+)*/,
  transformer: (text: string) => text.split(/, | and /).map(Number)
});

/** Readora's fixtures, the ones playwright-bdd runs scenarios with, and a fresh `story` per scenario. */
export const test = mergeTests(readoraTest, bddTest).extend<{ story: Story }>({
  story: async ({ request }, use) => {
    await use(new Story(request));
  }
});
