import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { HomePage } from '@app/features/home/home-page/home-page';
import { WorkSummary } from '@app/core/models/catalog';
import { RankedWork, Release } from '@app/core/models/discovery';
import { HistoryItem } from '@app/core/models/library';
import { ReadingList } from '@app/core/models/reading-lists';
import { givenIAmSignedInWith } from '../../../core/auth/auth-fixtures';
import { ANY_URL, API, FIXED_NOW, freezeDate, ok, provideHttpTesting, settle } from '../../../test-utils';

function series(id: string, title: string): WorkSummary {
  return { id, title, type: 'MANHWA', status: 'ONGOING', author: 'Chugong', demographic: null, coverImageUrl: `https://cdn.readora.test/${id}.webp`, coverThumbnailUrl: null, genres: ['Action', 'Fantasy'] };
}

const SOLO = series('w-solo', 'Solo Leveling');
const ORV = series('w-orv', 'Omniscient Reader');
const HORIMIYA = series('w-hori', 'Horimiya');

const RANKING: RankedWork[] = [SOLO, ORV, HORIMIYA].map((work, index) => ({ rank: index + 1, work, score: 100 - index, ratings: 0 }));

function release(work: WorkSummary, chapter: string, read = false): Release {
  return { work, team: { id: 't-1', name: 'Shadow Scans' }, chapterId: `c-${work.id}-${chapter}`, chapterNumber: chapter, chapterTitle: '', publishedAt: FIXED_NOW.toISOString(), read };
}

function lastRead(work: WorkSummary, chapter: string, finished: boolean): HistoryItem {
  return { work, lastRead: { chapterId: `c-${work.id}-${chapter}`, workId: work.id, chapterNumber: chapter, readAt: FIXED_NOW.toISOString(), finished } };
}

const LIST: ReadingList = { id: 'l-1', title: 'Best of action', description: '', published: true, ownerUsername: 'camille', ownerId: 'u-1', upvotes: 4, items: [{ work: SOLO, note: null }], updatedAt: '' };

/** What the API answers for each section of the page; the scenario overrides the part it is about. */
interface Answers {
  weekly: RankedWork[] | 'fails';
  latest: Release[];
  topRated: RankedWork[];
  lists: ReadingList[];
  genres: string[];
  history: HistoryItem[];
  mine: Release[];
}

const DEFAULTS: Answers = { weekly: RANKING, latest: [release(ORV, '7')], topRated: [{ rank: 1, work: HORIMIYA, score: 9.2, ratings: 12 }], lists: [LIST], genres: ['Action', 'Romance'], history: [], mine: [] };

describe('HomePage (US-14)', () => {
  let fixture: ComponentFixture<HomePage>;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter(ANY_URL), ...provideHttpTesting()] });
    http = TestBed.inject(HttpTestingController);
    freezeDate();
  });

  afterEach(() => http.verify());

  it('A visitor sees what is read this week', async () => {
    await givenIOpenTheHomePage({ weekly: RANKING });

    thenTheFeaturedSeriesIs({ title: 'Solo Leveling', href: '/works/w-solo' });
    thenTheFeaturedCoverLoadsFirst();
    thenTheNumberedListIs(['Rank 2 Omniscient Reader', 'Rank 3 Horimiya']);
    thenThereIsALinkTo('See all: Most read this week', '/rankings');
  });

  it('I can continue reading from the home page', async () => {
    await givenIAmSignedInWith(['LIBRARY_USE']);

    await givenIOpenTheHomePage({ history: [lastRead(SOLO, '12', false)] });

    thenTheSectionOffers('Continue reading', { series: 'Solo Leveling', line: 'Chapter 12' });
    thenTheSectionLinksTo('Continue reading', 'Continue', '/read/c-w-solo-12');
  });

  it('New chapters of my library are on the home page', async () => {
    await givenIAmSignedInWith(['LIBRARY_USE']);

    await givenIOpenTheHomePage({ mine: [release(HORIMIYA, '30'), release(ORV, '6', true)] });

    thenTheSectionOffers('New in your library', { series: 'Horimiya', line: 'Chapter 30' });
    thenTheSectionLinksTo('New in your library', 'Read', '/read/c-w-hori-30');
    thenTheSectionDoesNotShow('New in your library', 'Omniscient Reader');
  });

  it('Several new chapters of one series make one tile', async () => {
    await givenIAmSignedInWith(['LIBRARY_USE']);

    await givenIOpenTheHomePage({ mine: [release(SOLO, '8'), release(SOLO, '7'), release(SOLO, '6')] });

    thenTheSectionShowsTimes('New in your library', 'Solo Leveling', 1);
    thenTheSectionOffers('New in your library', { series: 'Solo Leveling', line: '3 new' });
    thenTheSectionLinksTo('New in your library', 'Read', '/read/c-w-solo-6');
  });

  it('A visitor is invited to create an account after seeing the content', async () => {
    await givenIOpenTheHomePage({});

    thenTheSectionsComeInOrder(['Most read this week', 'Latest updates', 'Top rated', 'Pick up where you stopped', 'Reading lists from the community', 'Browse by genre']);
    thenThereIsALinkTo('Create a free account', '/register');
  });

  it('shows no invitation and asks for the personal sections once I am signed in', async () => {
    await givenIAmSignedInWith(['LIBRARY_USE']);

    await givenIOpenTheHomePage({ history: [lastRead(SOLO, '12', true)] });

    thenThereIsNoSection('Pick up where you stopped');
    thenTheSectionLinksTo('Continue reading', 'Next chapter', '/works/w-solo#chapters');
  });

  it('never asks a visitor for a history or a library', async () => {
    await givenIOpenTheHomePage({});

    thenThereIsNoSection('Continue reading');
    thenThereIsNoSection('New in your library');
  });

  it('has its main heading before anything is loaded', () => {
    givenThePageIsRendered();

    thenTheMainHeadingIs('Read manga, manhwa and comics');

    whenTheRequestsAreLeftUnanswered();
  });

  it('sends the visitor to the catalog when nothing was read this week', async () => {
    await givenIOpenTheHomePage({ weekly: [] });

    thenTheSectionLinksTo('Most read this week', 'Browse the catalog', '/works');
  });

  it('offers Retry when the ranking cannot be loaded, and Retry loads it', async () => {
    await givenIOpenTheHomePage({ weekly: 'fails' });

    thenTheSectionSays('Most read this week', "This week's ranking could not be loaded.");

    await whenIRetryTheRankingAndItAnswers(RANKING);

    thenTheFeaturedSeriesIs({ title: 'Solo Leveling', href: '/works/w-solo' });
  });

  it('links each genre to the catalog filtered by it', async () => {
    await givenIOpenTheHomePage({ genres: ['Action', 'Romance'] });

    thenTheSectionLinksTo('Browse by genre', 'Romance', '/works?genre=Romance');
  });

  function givenThePageIsRendered(): void {
    fixture = TestBed.createComponent(HomePage);
    fixture.detectChanges();
  }

  async function givenIOpenTheHomePage(overrides: Partial<Answers>): Promise<void> {
    const answers = { ...DEFAULTS, ...overrides };
    givenThePageIsRendered();
    await settle(fixture);
    http.expectOne(`${API}/works/genres`).flush(ok(answers.genres));
    const weekly = http.expectOne((r) => r.url === `${API}/rankings/popular` && r.params.get('period') === 'WEEK');
    if (answers.weekly === 'fails') {
      weekly.error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });
    } else {
      weekly.flush(ok(answers.weekly));
    }
    http.expectOne(`${API}/rankings/top-rated`).flush(ok(answers.topRated));
    http.expectOne(`${API}/lists`).flush(ok(answers.lists));
    for (const request of http.match((r) => r.url === `${API}/updates`)) {
      request.flush(ok(request.request.params.get('mine') === 'true' ? answers.mine : answers.latest));
    }
    http.match(`${API}/reading/history`).forEach((request) => request.flush(ok(answers.history)));
    await settle(fixture);
  }

  async function whenIRetryTheRankingAndItAnswers(ranking: RankedWork[]): Promise<void> {
    const retry = Array.from(section('Most read this week').querySelectorAll('button')).find((button) => button.textContent?.trim() === 'Retry')!;
    retry.click();
    await settle(fixture);
    http.expectOne((r) => r.url === `${API}/rankings/popular`).flush(ok(ranking));
    await settle(fixture);
  }

  /** The page under test is only rendered: its requests are part of other scenarios. */
  function whenTheRequestsAreLeftUnanswered(): void {
    http.match(() => true);
  }

  function thenTheMainHeadingIs(heading: string): void {
    expect(fixture.nativeElement.querySelector('h1').textContent.trim()).toBe(heading);
  }

  function thenTheFeaturedSeriesIs(expected: { title: string; href: string }): void {
    const link: HTMLAnchorElement = section('Most read this week').querySelector('h3 a')!;
    expect({ title: link.textContent?.trim(), href: link.getAttribute('href') }).toEqual(expected);
  }

  function thenTheFeaturedCoverLoadsFirst(): void {
    const cover: HTMLImageElement = section('Most read this week').querySelector('article img')!;
    expect(cover.getAttribute('fetchpriority')).toBe('high');
  }

  function thenTheNumberedListIs(entries: string[]): void {
    const items = Array.from(section('Most read this week').querySelectorAll('ol[start="2"] > li'));
    expect(items.map((item) => `${text(item.querySelector('.rank'))} ${text(item.querySelector('a'))}`)).toEqual(entries);
  }

  function thenThereIsALinkTo(name: string, href: string): void {
    const links: HTMLAnchorElement[] = Array.from(fixture.nativeElement.querySelectorAll('a'));
    expect(links.find((a) => text(a) === name)?.getAttribute('href')).toBe(href);
  }

  function thenTheSectionOffers(heading: string, expected: { series: string; line: string }): void {
    const content = text(section(heading));
    expect(content).toContain(expected.series);
    expect(content).toContain(expected.line);
  }

  function thenTheSectionLinksTo(heading: string, name: string, href: string): void {
    const links: HTMLAnchorElement[] = Array.from(section(heading).querySelectorAll('a'));
    expect(links.find((a) => text(a) === name)?.getAttribute('href')).toBe(href);
  }

  function thenTheSectionDoesNotShow(heading: string, series: string): void {
    expect(text(section(heading))).not.toContain(series);
  }

  function thenTheSectionShowsTimes(heading: string, series: string, times: number): void {
    const titles = Array.from(section(heading).querySelectorAll('.title')).map(text);
    expect(titles.filter((title) => title === series)).toHaveLength(times);
  }

  function thenTheSectionSays(heading: string, message: string): void {
    expect(text(section(heading))).toContain(message);
  }

  function thenThereIsNoSection(heading: string): void {
    expect(headings()).not.toContain(heading);
  }

  function thenTheSectionsComeInOrder(expected: string[]): void {
    expect(headings()).toEqual(expected);
  }

  function headings(): string[] {
    return Array.from<HTMLElement>(fixture.nativeElement.querySelectorAll('h2')).map(text);
  }

  function section(heading: string): HTMLElement {
    const title = Array.from<HTMLElement>(fixture.nativeElement.querySelectorAll('h2')).find((h2) => text(h2) === heading)!;
    return title.closest('section')!;
  }

  function text(element: Element | null): string {
    return (element?.textContent ?? '').replace(/\s+/g, ' ').trim();
  }
});
