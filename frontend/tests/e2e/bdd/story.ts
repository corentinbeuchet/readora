import { APIRequestContext } from '@playwright/test';
import {
  ChapterPages,
  E2E_TEAMS,
  PASSWORD,
  PUBLISHER,
  PublishingTeam,
  RegisteredAccount,
  SeriesDescription,
  TaskBoard,
  TeamWithSeries,
  addSeriesToTeam,
  createSeries,
  describeSeries,
  e2eTeam,
  givenIAmThePublisher,
  publishChapterFor,
  registerAccountNamed,
  uniqueSuffix
} from '../support/helpers';

/** The team that publishes a series when the scenario doesn't say which. */
export const ITS_TEAM = 'its team';

/** Who a scenario's person logs in as. */
export interface Account {
  email: string;
  password: string;
  username?: string;
  accessToken?: string;
  displayName?: string;
}

/**
 * What a scenario named, mapped to what its steps created. Scenarios speak of "Solo Leveling", "Moon Scans" or "Bob";
 * the steps create fresh data instead (tests never depend on seed data or on each other), and later steps find it
 * here by the scenario's names.
 *
 * - A series or team is created as `title(name)`: the scenario's name after a prefix unique to this scenario, so a
 *   search for part of the name, typed after the same prefix, finds this scenario's series only.
 * - Teams that publish chapters are the two e2e teams led by the publisher account (the first team named is the
 *   first e2e team, which creates the series; the second one joins it): a new team's first chapter would wait for a
 *   moderator, and the publisher may moderate.
 * - A reader is a new account named `username(name)`, a scanlator who publishes is the publisher account.
 */
export class Story {
  private readonly suffix = uniqueSuffix();
  private readonly seriesByName = new Map<string, { workId: string; title: string; description: SeriesDescription }>();
  private readonly publishedNumbers = new Map<string, Set<number>>();
  /** `series|number` → the chapter's id (the first version published, when several teams published it). */
  private readonly chapterIdsByNumber = new Map<string, string>();
  private readonly publishers = new Map<string, PublishingTeam>();
  /** `teamId|workId` of the teams known to work on a series. */
  private readonly onSeries = new Set<string>();
  private readonly teamsByName = new Map<string, TeamWithSeries>();
  private readonly boards = new Map<string, TaskBoard>();
  private readonly ledTeams = new Map<string, string>();
  private readonly accounts = new Map<string, Account>();
  private readonly memory = new Map<string, string>();
  /** The person the scenario follows ("he", "she"): the last one a Given introduced. */
  private actorName?: string;

  constructor(private readonly request: APIRequestContext) {}

  title(name: string): string {
    return `E2E ${this.suffix} ${name}`;
  }

  username(name: string): string {
    return `${this.suffix}_${name.toLowerCase()}`;
  }

  /**
   * The series the scenario calls `name`, created by the first e2e team the first time it is named (with
   * `description`, when the scenario describes it, over the defaults).
   */
  async series(name: string, description: Partial<SeriesDescription> = {}): Promise<{ workId: string; title: string }> {
    let series = this.seriesByName.get(name);
    if (!series) {
      const created = await createSeries(this.request, await givenIAmThePublisher(this.request), { ...description, title: this.title(name) });
      series = { workId: created.workId, title: created.title, description: created.description };
      this.seriesByName.set(name, series);
      this.onSeries.add(`${created.team.id}|${created.workId}`);
    }
    return series;
  }

  /** Gives the series these facts (other titles, artist, …), keeping the rest of its description. */
  async giveFacts(name: string, facts: NonNullable<SeriesDescription['facts']>): Promise<void> {
    const series = this.named(this.seriesByName, name, 'series');
    series.description = { ...series.description, facts };
    await describeSeries(this.request, await givenIAmThePublisher(this.request), series.workId, series.description);
  }

  facts(name: string): NonNullable<SeriesDescription['facts']> {
    return this.named(this.seriesByName, name, 'series').description.facts ?? {};
  }

  /** The only series of the scenario, for steps that don't name it ("the end of chapter 5"). */
  theSeries(): { workId: string; title: string } {
    return this.seriesByName.get(this.theSeriesName())!;
  }

  theSeriesName(): string {
    const names = [...this.seriesByName.keys()];
    if (names.length !== 1) {
      throw new Error(`The scenario has ${names.length} series: name the one the step is about.`);
    }
    return names[0];
  }

  /** A team that publishes chapters: the first one named is the first e2e team, the second the other one. */
  async publishingTeam(name: string): Promise<PublishingTeam> {
    let team = this.publishers.get(name);
    if (!team) {
      const slots = [E2E_TEAMS.first, E2E_TEAMS.second];
      if (this.publishers.size >= slots.length) {
        throw new Error(`A scenario has at most ${slots.length} publishing teams, "${name}" would be one more.`);
      }
      const e2e = await e2eTeam(this.request, await givenIAmThePublisher(this.request), slots[this.publishers.size]);
      team = { id: e2e.id, name: e2e.name, chapterIds: {} };
      this.publishers.set(name, team);
    }
    return team;
  }

  /** The publishing team, which must have been named before. */
  team(name: string): PublishingTeam {
    return this.named(this.publishers, name, 'publishing team');
  }

  async teamWorksOn(teamName: string, seriesName: string): Promise<void> {
    const team = await this.publishingTeam(teamName);
    const series = await this.series(seriesName);
    if (!this.onSeries.has(`${team.id}|${series.workId}`)) {
      await addSeriesToTeam(this.request, await givenIAmThePublisher(this.request), team.id, series.workId);
      this.onSeries.add(`${team.id}|${series.workId}`);
    }
  }

  async publish(teamName: string, seriesName: string, chapterNumbers: number[], pages: ChapterPages = {}): Promise<void> {
    await this.teamWorksOn(teamName, seriesName);
    const team = this.team(teamName);
    const series = await this.series(seriesName);
    const published = this.publishedNumbers.get(seriesName) ?? new Set<number>();
    for (const chapterNumber of chapterNumbers) {
      const id = await publishChapterFor(this.request, await givenIAmThePublisher(this.request), series.workId, team, String(chapterNumber), `Chapter ${chapterNumber}`, pages);
      published.add(chapterNumber);
      if (!this.chapterIdsByNumber.has(`${seriesName}|${chapterNumber}`)) {
        this.chapterIdsByNumber.set(`${seriesName}|${chapterNumber}`, id);
      }
    }
    this.publishedNumbers.set(seriesName, published);
  }

  /**
   * The id of chapter `chapterNumber` of the series, published by `ITS_TEAM` the first time a step needs it (a series
   * "in the catalog" has its chapters): five full-size pages unless `pages` says otherwise.
   */
  async chapter(seriesName: string, chapterNumber: number, pages: ChapterPages = {}): Promise<string> {
    if (!this.chapterIdsByNumber.has(`${seriesName}|${chapterNumber}`)) {
      await this.publishingTeam(ITS_TEAM);
      await this.publish(ITS_TEAM, seriesName, [chapterNumber], { count: 5, fullSize: true, ...pages });
    }
    return this.chapterIdsByNumber.get(`${seriesName}|${chapterNumber}`)!;
  }

  /** Every chapter number published in the series, by any team, smallest first. */
  chapterNumbers(seriesName: string): number[] {
    return [...(this.publishedNumbers.get(seriesName) ?? [])].sort((a, b) => a - b);
  }

  /** A team of readers that publishes nothing in the scenario (its roster, its series, its task boards). */
  addTeam(name: string, team: TeamWithSeries): void {
    this.teamsByName.set(name, team);
  }

  readersTeam(name: string): TeamWithSeries {
    return this.named(this.teamsByName, name, 'team');
  }

  /** The real name of a team the scenario named, publishing or not. */
  teamName(name: string): string {
    return (this.publishers.get(name) ?? this.readersTeam(name)).name;
  }

  addBoard(seriesName: string, board: TaskBoard): void {
    this.boards.set(seriesName, board);
  }

  board(seriesName: string): TaskBoard {
    return this.named(this.boards, seriesName, 'task board');
  }

  /** The series of the scenario's only task board. */
  theBoardSeries(): string {
    const names = [...this.boards.keys()];
    if (names.length !== 1) {
      throw new Error(`The scenario has ${names.length} task boards: name the series the step is about.`);
    }
    return names[0];
  }

  /** The person leads the team (for steps that say "her team"). */
  leads(person: string, teamName: string): void {
    this.ledTeams.set(person, teamName);
  }

  teamLedBy(person: string): string {
    return this.named(this.ledTeams, person, 'team led by');
  }

  /** A new reader account for the person the scenario calls `name`. */
  async newReader(name: string, displayName?: string): Promise<RegisteredAccount> {
    const account = await registerAccountNamed(this.request, this.username(name));
    this.accounts.set(name, { ...account, password: PASSWORD, displayName });
    return account;
  }

  /** The person publishes as the publisher account. */
  isThePublisher(name: string): void {
    this.accounts.set(name, PUBLISHER);
  }

  account(name: string): Account {
    return this.named(this.accounts, name, 'person');
  }

  /** Anything else a later step needs by name: a list's id, the genre "it" refers to. */
  remember(key: string, value: string): void {
    this.memory.set(key, value);
  }

  recall(key: string): string {
    return this.named(this.memory, key, 'remembered');
  }

  follow(name: string): void {
    this.actorName = name;
  }

  actorNamed(): string {
    if (!this.actorName) {
      throw new Error('No Given step introduced the person this step is about.');
    }
    return this.actorName;
  }

  /** The person the scenario follows. */
  actor(): Account {
    return this.account(this.actorNamed());
  }

  private named<T>(entries: Map<string, T>, name: string, kind: string): T {
    const entry = entries.get(name);
    if (!entry) {
      throw new Error(`No ${kind} "${name}" in this scenario: a Given step must create it first.`);
    }
    return entry;
  }
}
