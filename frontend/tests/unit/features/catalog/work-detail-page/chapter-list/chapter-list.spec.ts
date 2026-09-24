import { Component, inject, input, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { ChapterList } from '@app/features/catalog/work-detail-page/chapter-list/chapter-list';
import { ChapterSummary } from '@app/core/models/chapter';
import { WorkProgress } from '@app/core/models/library';
import { PREFERRED_TEAMS_KEY } from '@app/core/reading/preferred-team-store';
import { BrowserStorage } from '@app/core/storage/browser-storage';
import { BlankPage, MemoryStorage, settle } from '../../../../test-utils';

const SHADOW = { id: 't-shadow', name: 'Shadow Scans' };
const MOON = { id: 't-moon', name: 'Moon Scans' };
const SUN = { id: 't-sun', name: 'Sun Scans' };
const STAR = { id: 't-star', name: 'Star Scans' };
const ELF = { id: 't-elf', name: 'Elf Toon' };

/** What the page gives the list, built per test (nothing mutable is shared between tests). */
class SeriesData {
  readonly chapters = signal<ChapterSummary[]>([]);
  readonly progress = signal<WorkProgress | null>(null);
  readonly marked = signal<string[]>([]);
}

/** The series page as far as the list is concerned: `?team=` and `?order=` reach it as inputs. */
@Component({
  imports: [ChapterList],
  template: `<app-chapter-list workId="w-1" [chapters]="chapters()" [progress]="progress()" [canMark]="true" [team]="team()" [order]="order()"
    (markPrevious)="mark($event)" />`
})
class SeriesPageHost {
  private readonly data = inject(SeriesData);
  readonly team = input<string>();
  readonly order = input<string>();
  protected readonly chapters = this.data.chapters;
  protected readonly progress = this.data.progress;

  protected mark(chapterId: string): void {
    this.data.marked.update((ids) => [...ids, chapterId]);
  }
}

describe('ChapterList (US-12)', () => {
  let harness: RouterTestingHarness | undefined;
  let storage: MemoryStorage;
  let data: SeriesData;

  beforeEach(() => {
    harness = undefined;
    storage = new MemoryStorage();
    data = new SeriesData();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'works/w-1', component: SeriesPageHost }, { path: 'read/:chapterId', component: BlankPage }], withComponentInputBinding()),
        { provide: BrowserStorage, useValue: storage },
        { provide: SeriesData, useValue: data }
      ]
    });
  });

  it('One row per chapter number with its versions', async () => {
    givenTheChapters([version('5', SHADOW), version('5', MOON), version('6', SHADOW)]);

    await whenIOpenTheSeries('/works/w-1');

    thenTheRowsAre(['Ch. 5', 'Ch. 6']);
    thenRowOpens(1, { team: 'Shadow Scans', href: '/read/c-5-t-shadow' });
    thenRowAlsoOffers(1, [{ name: 'Read chapter 5 by Moon Scans', href: '/read/c-5-t-moon' }]);
    thenRowAlsoOffers(2, []);
  });

  it('Filtering the chapter list by team', async () => {
    givenTheChapters([version('5', SHADOW), version('5', MOON), version('6', SHADOW)]);
    await whenIOpenTheSeries('/works/w-1');

    await whenIFilterBy('Moon Scans');

    thenTheUrlIs('/works/w-1?team=t-moon#chapters');
    thenTheRowsAre(['Ch. 5']);
    thenRowOpens(1, { team: 'Moon Scans', href: '/read/c-5-t-moon' });

    await whenIFilterBy('All teams');

    thenTheUrlIs('/works/w-1#chapters');
    thenTheRowsAre(['Ch. 5', 'Ch. 6']);
  });

  it('Sorting chapters newest or oldest first', async () => {
    givenTheChapters([version('5', SHADOW), version('6', SHADOW), version('7', SHADOW)]);
    await whenIOpenTheSeries('/works/w-1');

    await whenIChooseTheOrder('Newest first');

    thenTheUrlIs('/works/w-1?order=newest#chapters');
    thenTheRowsAre(['Ch. 7', 'Ch. 6', 'Ch. 5']);
    thenTheOrderPressedIs('Newest first');

    await whenIChooseTheOrder('Oldest first');

    thenTheRowsAre(['Ch. 5', 'Ch. 6', 'Ch. 7']);
  });

  it('a single team needs no filter', async () => {
    givenTheChapters([version('5', SHADOW)]);

    await whenIOpenTheSeries('/works/w-1');

    thenThereIsNoTeamFilter();
  });

  it('choosing the version of another team makes it my team for the series', async () => {
    givenTheChapters([version('5', SHADOW), version('5', MOON), version('6', SHADOW), version('6', MOON), version('7', SHADOW)]);
    await whenIOpenTheSeries('/works/w-1');

    await whenIChooseTheVersion(1, 'Moon Scans');

    thenTheUrlIs('/read/c-5-t-moon');
    thenTheBrowserRemembersMyTeam('w-1', 't-moon');

    await whenIOpenTheSeries('/works/w-1');

    thenRowOpens(1, { team: 'Moon Scans', href: '/read/c-5-t-moon' });
    thenRowOpens(2, { team: 'Moon Scans', href: '/read/c-6-t-moon' });
    thenRowOpens(3, { team: 'Shadow Scans', href: '/read/c-7-t-shadow' });
  });

  it('The series page opens the chapters in the versions by my team', async () => {
    givenTheBrowserRemembersMyTeam('w-1', 't-moon');
    givenTheChapters([version('5', SHADOW), version('5', MOON)]);

    await whenIOpenTheSeries('/works/w-1');

    thenRowOpens(1, { team: 'Moon Scans', href: '/read/c-5-t-moon' });
    thenRowAlsoOffers(1, [{ name: 'Read chapter 5 by Shadow Scans', href: '/read/c-5-t-shadow' }]);
  });

  it('past three teams, the others are behind a button', async () => {
    givenTheChapters([version('5', SHADOW), version('5', MOON), version('5', SUN), version('5', STAR), version('5', ELF)]);
    await whenIOpenTheSeries('/works/w-1');

    thenRowAlsoOffersTeams(1, ['Moon Scans', 'Sun Scans']);
    thenTheMoreTeamsButtonSays(1, '2 more teams for chapter 5', { expanded: false });
    thenTheMoreTeamsButtonControlsTheVersionList(1);

    await whenIShowMoreTeams(1);

    thenRowAlsoOffersTeams(1, ['Moon Scans', 'Sun Scans', 'Star Scans', 'Elf Toon']);
    thenTheMoreTeamsButtonSays(1, 'Fewer teams for chapter 5', { expanded: true });
  });

  it('read marks and "Next up" follow the chapter number, and "Next up" opens the version the server chose', async () => {
    givenTheChapters([version('5', SHADOW), version('5', MOON), version('6', SHADOW), version('6', MOON)]);
    givenMyProgress({ read: ['5'], nextNumber: '6', nextId: 'c-6-t-moon' });

    await whenIOpenTheSeries('/works/w-1');

    thenRowIsRead(1);
    thenRowIsNextUp(2);
    thenRowOpens(2, { team: 'Moon Scans', href: '/read/c-6-t-moon' });
  });

  it('"Mark all previous as read" is offered on an unread chapter with unread numbers before it, for the version shown', async () => {
    givenTheChapters([version('5', SHADOW), version('5', MOON), version('6', SHADOW), version('7', MOON)]);
    givenMyProgress({ read: [], nextNumber: '5', nextId: 'c-5-t-shadow' });
    await whenIOpenTheSeries('/works/w-1');

    thenMarkPreviousIsOfferedBefore(['6', '7']);

    await whenIMarkEverythingBefore('7');

    thenThePageIsAskedToMarkBefore('c-7-t-moon');
  });

  function givenTheChapters(list: ChapterSummary[]): void {
    data.chapters.set(list);
  }

  function givenMyProgress(mine: { read: string[]; nextNumber: string; nextId: string }): void {
    data.progress.set({ workId: 'w-1', finishedChapterIds: [], finishedChapterNumbers: mine.read, nextChapterNumber: mine.nextNumber, nextChapterId: mine.nextId });
  }

  function givenTheBrowserRemembersMyTeam(workId: string, teamId: string): void {
    storage.write(PREFERRED_TEAMS_KEY, { [workId]: teamId });
  }

  async function whenIOpenTheSeries(url: string): Promise<void> {
    harness ??= await RouterTestingHarness.create();
    await harness.navigateByUrl(url);
    await settle(harness!);
  }

  async function whenIFilterBy(team: string): Promise<void> {
    const select = page().querySelector<HTMLSelectElement>('.team-filter select')!;
    select.value = Array.from(select.options).find((option) => option.textContent!.trim() === team)!.value;
    select.dispatchEvent(new Event('change'));
    await settle(harness!);
  }

  async function whenIChooseTheOrder(label: string): Promise<void> {
    sortButton(label).click();
    await settle(harness!);
  }

  async function whenIChooseTheVersion(row: number, team: string): Promise<void> {
    otherVersionLinks(row).find((a) => a.textContent!.includes(team))!.click();
    await settle(harness!);
  }

  async function whenIShowMoreTeams(row: number): Promise<void> {
    moreTeamsButton(row).click();
    await settle(harness!);
  }

  async function whenIMarkEverythingBefore(number: string): Promise<void> {
    markPreviousButtons().find((button) => button.textContent!.includes(`before chapter ${number}`))!.click();
    await settle(harness!);
  }

  function thenTheRowsAre(numbers: string[]): void {
    expect(rows().map((row) => row.querySelector('.chapter-number')!.textContent!.trim())).toEqual(numbers);
  }

  function thenRowOpens(row: number, version: { team: string; href: string }): void {
    const link = rows()[row - 1].querySelector('a.chapter-link')!;
    expect(link.getAttribute('href')).toBe(version.href);
    expect(link.querySelector('.chapter-team')!.textContent!.trim()).toBe(`by ${version.team}`);
  }

  function thenRowAlsoOffers(row: number, versions: { name: string; href: string }[]): void {
    expect(otherVersionLinks(row).map((a) => ({ name: text(a), href: a.getAttribute('href') }))).toEqual(versions);
  }

  function thenRowAlsoOffersTeams(row: number, teams: string[]): void {
    expect(otherVersionLinks(row).map((a) => text(a).replace(/^Read chapter \S+ by /, ''))).toEqual(teams);
  }

  function thenTheMoreTeamsButtonSays(row: number, label: string, state: { expanded: boolean }): void {
    expect(text(moreTeamsButton(row))).toBe(label);
    expect(moreTeamsButton(row).getAttribute('aria-expanded')).toBe(String(state.expanded));
  }

  function thenTheMoreTeamsButtonControlsTheVersionList(row: number): void {
    const list = moreTeamsButton(row).closest('.chapter-row')!.querySelector('.version-list')!;
    expect(moreTeamsButton(row).getAttribute('aria-controls')).toBe(list.id);
  }

  function thenTheUrlIs(url: string): void {
    expect(TestBed.inject(Router).url).toBe(url);
  }

  function thenTheOrderPressedIs(label: string): void {
    expect(sortButton(label).getAttribute('aria-pressed')).toBe('true');
  }

  function thenThereIsNoTeamFilter(): void {
    expect(page().querySelector('.team-filter')).toBeNull();
  }

  function thenTheBrowserRemembersMyTeam(workId: string, teamId: string): void {
    expect(storage.read(PREFERRED_TEAMS_KEY)).toEqual({ [workId]: teamId });
  }

  function thenRowIsRead(row: number): void {
    expect(text(rows()[row - 1])).toContain('Read');
  }

  function thenRowIsNextUp(row: number): void {
    expect(text(rows()[row - 1])).toContain('Next up');
  }

  function thenMarkPreviousIsOfferedBefore(numbers: string[]): void {
    expect(markPreviousButtons().map(text)).toEqual(numbers.map((n) => `Mark all previous as read (before chapter ${n})`));
  }

  function thenThePageIsAskedToMarkBefore(chapterId: string): void {
    expect(data.marked()).toEqual([chapterId]);
  }

  function version(chapterNumber: string, team: { id: string; name: string }): ChapterSummary {
    return { id: `c-${chapterNumber}-${team.id}`, workId: 'w-1', chapterNumber, title: `Chapter ${chapterNumber}`, status: 'PUBLISHED', pageCount: 10, publishedAt: null, team };
  }

  function page(): HTMLElement {
    return harness!.routeNativeElement!;
  }

  function rows(): HTMLElement[] {
    return Array.from(page().querySelectorAll<HTMLElement>('.chapter-row'));
  }

  function otherVersionLinks(row: number): HTMLAnchorElement[] {
    return Array.from(rows()[row - 1].querySelectorAll<HTMLAnchorElement>('.version-list a'));
  }

  function moreTeamsButton(row: number): HTMLButtonElement {
    return rows()[row - 1].querySelector<HTMLButtonElement>('button[aria-expanded]')!;
  }

  function sortButton(label: string): HTMLButtonElement {
    return Array.from(page().querySelectorAll<HTMLButtonElement>('.sort button')).find((button) => text(button) === label)!;
  }

  function markPreviousButtons(): HTMLButtonElement[] {
    return Array.from(page().querySelectorAll<HTMLButtonElement>('.mark-previous'));
  }

  function text(element: Element): string {
    return element.textContent!.replace(/\s+/g, ' ').trim();
  }
});
