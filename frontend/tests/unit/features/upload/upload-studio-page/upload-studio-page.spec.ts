import { CreateTaskRequest } from '@app/core/models/scanlation';
import { PagePayload } from '@app/core/models/chapter';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController, TestRequest } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { UploadStudioPage, parseChapterNumber } from '@app/features/upload/upload-studio-page/upload-studio-page';
import { givenIAmSignedInWith } from '../../../core/auth/auth-fixtures';
import { ANY_URL, API, fail, ok, provideHttpTesting, InstantImage, choosePageFiles } from '../../../test-utils';
import { MyTeam } from '@app/core/models/scanlation';
import { WorkSummary } from '@app/core/models/catalog';

const WORK = { id: 'work-1', title: 'Blue Lock', synopsis: '', type: 'MANGA', status: 'ONGOING', coverImageUrl: '', genres: ['Action'] };
const CHAPTER = { id: 'chap-1', workId: 'work-1', chapterNumber: '3', title: '', status: 'PUBLISHED', pages: [] };
const SUCCESS = 'Series & Chapter Uploaded Successfully!';

interface SeriesDraft {
  title: string;
  author?: string;
  demographic?: string;
  synopsis?: string;
}

interface Draft {
  series: SeriesDraft;
  chapter: { number: string; title?: string };
  pages: string[];
  mode?: 'DIRECT' | 'SCANLATION';
}

/** How the storage endpoint answers one page upload. */
type PageAnswer = { storageKey: string; cdnUrl: string; liteCdnUrl?: string } | { rejectedWith: string };

/**
 * The studio driven like a user: fields are typed into, buttons clicked, pages added through the file input, and the
 * API answered at the HTTP level. Nothing reads or calls the component's own members.
 */
/** The team I lead in most tests: a new series belongs to it. */
const MY_TEAM: MyTeam = { id: 'team-1', name: 'My Team', description: null, myRoles: ['LEADER'], boards: [] };

/** A team's task board for the series, as `GET /works/{id}/projects` lists it (only what the studio reads). */
interface Board {
  id: string;
  teamId: string;
  boardEnabled: boolean;
}

describe('UploadStudioPage', () => {
  let fixture: ComponentFixture<UploadStudioPage>;
  let http: HttpTestingController;
  let created: string[];
  let revoked: string[];
  let createdBeforeStartingOver: string[];
  let workId: string;
  let workRequest: TestRequest;
  let chapterRequest: TestRequest;
  let taskRequest: TestRequest;
  let pageUploads: TestRequest[];
  let boardRequest: TestRequest;
  /** My teams were loaded (once per test): by `givenILeadMyTeam` or by a block's own "given". */
  let myTeamsLoaded: boolean;

  beforeEach(async () => {
    created = [];
    revoked = [];
    myTeamsLoaded = false;
    vi.stubGlobal('Image', InstantImage);
    vi.spyOn(URL, 'createObjectURL').mockImplementation(() => {
      const url = `blob:test/${created.length + 1}`;
      created.push(url);
      return url;
    });
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation((url: string) => void revoked.push(url));
    await TestBed.configureTestingModule({
      imports: [UploadStudioPage],
      providers: [...provideHttpTesting(), provideRouter(ANY_URL)]
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    // Time is faked before the page exists: the series step looks for similar titles after a debounce.
    vi.useFakeTimers();
    fixture = TestBed.createComponent(UploadStudioPage);
    // Most tests create a series (`?create=series`); the "Which series?" step and existing series have their own blocks.
    fixture.componentRef.setInput('create', 'series');
    fixture.detectChanges();
  });

  afterEach(() => {
    http.verify();
    vi.useRealTimers();
  });

  it('starts on the series step with defaults, and moves on only once the title is filled', async () => {
    await givenIOpenTheStudio();

    thenTheStepIs('1. Manga / Series Information');
    thenTheSeriesTypeIs('MANGA');
    thenTheSeriesStatusIs('ONGOING');
    thenICannotClick('Next: Chapter Setup');

    whenITypeTheTitle('   ');

    thenICannotClick('Next: Chapter Setup');
    thenTheTitleErrorSays('Give the series a title');

    whenITypeTheTitle('Solo Leveling');
    await whenIGoToTheChapterSetup();

    thenTheStepIs('2. Initial Chapter Details');
    thenTheChapterNumberIs('1');
  });

  it('renders the publishing mode as a labelled native radio group', async () => {
    await givenIAmOnTheChapterSetupOf('Tower of God');

    thenISeeTheFieldGroup('Publishing Pipeline');
    thenThereArePublishingModes(2);
    thenPublishingModeIsChecked(1);

    whenIChoosePublishingMode(2);

    thenPublishingModeIsChecked(2);
    thenModeCardIsSelected(2);
  });

  it('toggles genres as pressed buttons and adds custom genres', async () => {
    await givenIOpenTheStudio();

    thenGenreIsPressed('Action');

    whenIToggleTheGenres('Action', 'Fantasy');

    thenGenreIsNotPressed('Action');
    thenGenreIsPressed('Fantasy');

    whenIAddTheCustomGenre('Cyberpunk');
    whenITypeTheTitle('Neon');
    await whenIGoToTheChapterSetup();
    whenIGoToThePages();

    thenICannotClick('Next: Review');

    await whenIAddPages('p1.png');
    whenIGoToTheReview();

    thenTheReviewSummaryShows('Fantasy, Cyberpunk');
  });

  it('only accepts a positive chapter number (never defaults to 1)', async () => {
    thenTheChapterNumberParsesAs('12.5', '12.5');
    thenTheChapterNumberParsesAs(' 010 ', '10');
    thenTheChapterNumbersAreRejected('', 'abc', '1abc', '0', '-2', '1e3', '1.');

    await givenIAmOnTheChapterSetupOf('Tower of God');

    whenITypeTheChapterNumber('1abc');

    thenICannotClick('Next: Upload Pages');
    thenTheChapterNumberIsMarkedInvalid();
    thenTheChapterNumberErrorSays('positive number such as 1, 10 or 12.5');

    whenITypeTheChapterNumber('12.5');
    whenIGoToThePages();

    thenTheStepIs('3. Chapter Pages');
  });

  it('step indicator marks the current step and only enables reachable steps', async () => {
    await givenIOpenTheStudio();

    thenTheStepButtonsDisabledAre([false, true, true, true]);
    thenStepIsCurrent(1);

    whenITypeTheTitle('Tower of God');

    thenTheStepButtonsDisabledAre([false, false, false, true]);

    whenIJumpToStep(2);

    thenTheStepIs('2. Initial Chapter Details');
    thenStepIsCurrent(2);
    thenStepIsCompleted(1);
  });

  it('publishes directly: creates the series, uploads the pages, publishes the chapter', async () => {
    await givenIAmOnTheReview({
      series: { title: 'Omniscient Reader', author: '  Sing Shong ', demographic: 'SHOUNEN', synopsis: 'Only I know the end of this world' },
      chapter: { number: '1', title: 'Prologue' },
      pages: ['p1.png']
    });

    await whenIPublish();
    await whenTheSeriesIsCreated({ ...WORK, id: 'work-123', title: 'Omniscient Reader' });

    thenTheSeriesWasCreatedWith({ title: 'Omniscient Reader', author: 'Sing Shong', demographic: 'SHOUNEN', synopsis: 'Only I know the end of this world' });

    await whenEveryPageUploads();
    await whenTheChapterIsPublished({ ...CHAPTER, id: 'chap-999', workId: 'work-123' });

    thenThePublishedChapterIncludes({ teamId: 'team-1', chapterNumber: '1', title: 'Prologue' });
    thenTheStepIs(SUCCESS);
    thenTheSuccessLinksAre(['/read/chap-999', '/works/work-123']);
  });

  it("a new team's first chapter is sent for review: the studio says so and offers no reading link yet", async () => {
    await givenIAmOnTheReview({ series: { title: 'Omniscient Reader' }, chapter: { number: '1' }, pages: ['p1.png'] });

    await whenIPublish();
    await whenTheSeriesIsCreated({ ...WORK, id: 'work-123', title: 'Omniscient Reader' });
    await whenEveryPageUploads();
    await whenTheChapterIsPublished({ ...CHAPTER, id: 'chap-999', workId: 'work-123', status: 'PENDING_REVIEW' });

    thenTheStepIs('Chapter sent for review');
    thenTheSuccessLinksAre(['/works/work-123']);
  });

  it('the facts typed in the series step are sent with the new series; what is left empty is left out', async () => {
    await givenIOpenTheStudio();
    whenITypeTheFacts({ otherTitles: 'Jeonjijeok Dokja Sijeom\n\nORV', artist: 'Sleepy-C', year: '2020', language: 'KOREAN' });
    await givenIAmOnTheReview({ series: { title: 'Omniscient Reader' }, chapter: { number: '1' }, pages: ['p1.png'] });

    await whenIPublish();
    await whenTheSeriesIsCreated({ ...WORK, id: 'work-123', title: 'Omniscient Reader' });

    thenTheSeriesWasCreatedWithTheFacts({ alternativeTitles: ['Jeonjijeok Dokja Sijeom', 'ORV'], artist: 'Sleepy-C', releaseYear: 2020, originalLanguage: 'KOREAN' });

    await whenEveryPageUploads();
    await whenTheChapterIsPublished({ ...CHAPTER, id: 'chap-999', workId: 'work-123' });
  });

  it('a year that is not a year keeps me on the series step', async () => {
    await givenIOpenTheStudio();
    whenITypeTheTitle('Omniscient Reader');

    whenITypeTheFacts({ year: '20' });

    thenICannotGoToTheChapterSetup();
  });

  it('shows the upload progress as a progressbar while publishing', async () => {
    await givenIAmOnTheReview({ series: { title: 'Blue Lock' }, chapter: { number: '3' }, pages: ['p1.png', 'p2.png'] });

    await whenIPublish();

    thenTheProgressBarRunsFrom(0, 100);
    thenTheProgressIsAboveZero();
    thenTheProgressSays('Creating series in catalog');

    // Answered so that no request is left pending.
    await whenCreatingTheSeriesFails('down', 503);
  });

  describe('publishing for a team (US-12)', () => {
    let lastAdd: TestRequest;
    const MOON_SCANS: MyTeam = { id: 'team-moon', name: 'Moon Scans', description: null, myRoles: ['LEADER'], boards: [] };

    it('publishes a chapter of an existing series for my team, without creating a series', async () => {
      await givenIOpenedTheStudioFor({ workId: 'work-77', teamId: 'team-moon' }, { series: { ...WORK, id: 'work-77', title: 'Solo Leveling' }, myTeams: [MOON_SCANS] });

      thenTheStepSays('You are publishing a chapter of Solo Leveling for the team Moon Scans.');

      await whenIFillTheChapterAndPages({ number: '5', pages: ['p1.png'] });

      thenTheReviewSummaryShows('Moon Scans');

      await whenIPublishTheChapter();
      await whenEveryPageUploads();
      await whenTheChapterIsPublished({ ...CHAPTER, id: 'chap-5', workId: 'work-77' }, [{ id: 'proj-shadow', teamId: 'team-shadow', boardEnabled: true }, { id: 'proj-moon', teamId: 'team-moon', boardEnabled: true }]);

      thenThePublishedChapterIncludes({ teamId: 'team-moon', chapterNumber: '5' });
      thenTheStepIs('Chapter published');
      thenTheStepSays('Chapter 5 of Solo Leveling is out, as the version of Moon Scans.');
    });

    const SOLO_LEVELING: WorkSummary = { id: 'work-11', title: 'Solo Leveling', type: 'MANHWA', status: 'COMPLETED', author: 'Chugong', demographic: null, coverImageUrl: null, genres: ['Action'] };

    it('Uploading starts by finding the series', async () => {
      await givenIOpenTheStudioWithoutASeries({ myTeams: [MOON_SCANS] });
      thenTheStepIs('Which series is the chapter for?');

      await whenISearchTheCatalogFor('solo', [SOLO_LEVELING]);

      thenTheFoundSeriesAre(['Solo Leveling']);
      thenTheSearchSummarySays('1 series matches “solo”.');

      await whenIChooseToCreateANewSeries();

      await thenIAmSentTo('/upload?create=series');
    });

    it('A leader publishes a chapter of a series already in the catalog', async () => {
      await givenIOpenTheStudioWithoutASeries({ myTeams: [MOON_SCANS] });
      await whenISearchTheCatalogFor('solo', [SOLO_LEVELING]);

      await whenIAddTheSeriesToMyTeamAndPublish('Add to Moon Scans and publish');

      thenTheSeriesWasAddedTo('team-moon', 'work-11');
      await thenIAmSentTo('/upload?workId=work-11&teamId=team-moon');

      await givenIOpenedTheStudioFor({ workId: 'work-11', teamId: 'team-moon' }, { series: { ...WORK, id: 'work-11', title: 'Solo Leveling' }, myTeams: [MOON_SCANS] });

      thenTheStepSays('You are publishing a chapter of Solo Leveling for the team Moon Scans.');
    });

    it('a team already on the series publishes into it without being added again', async () => {
      await givenIOpenTheStudioWithoutASeries({ myTeams: [{ ...MOON_SCANS, boards: [{ projectId: 'proj-moon', work: SOLO_LEVELING, boardEnabled: true }] }] });
      await whenISearchTheCatalogFor('solo', [SOLO_LEVELING]);

      await whenIChoose('Publish for Moon Scans');

      await thenIAmSentTo('/upload?workId=work-11&teamId=team-moon');
    });

    it('A similar title is flagged before creating a series', async () => {
      await givenIOpenTheStudio();

      await whenITypeTheTitleAndPause('Solo Leveling', [SOLO_LEVELING]);

      thenTheSimilarSeriesAre(['Solo Leveling']);
    });

    it("The upload shows the other teams' versions of the chapter", async () => {
      await givenIOpenedTheStudioFor({ workId: 'work-77', teamId: 'team-moon' }, { series: { ...WORK, id: 'work-77', title: 'Solo Leveling' }, myTeams: [MOON_SCANS] });
      await whenIGoToTheChapterSetupOfTheSeries([{ number: '5', team: { id: 'team-shadow', name: 'Shadow Scans' } }]);

      whenITypeTheChapterNumber('5');

      thenTheChapterStepSays('You are adding the version of Moon Scans.');
      thenTheOtherVersionsAre(['Shadow Scans']);
    });

    it('a chapter my team already published cannot be set up again', async () => {
      await givenIOpenedTheStudioFor({ workId: 'work-77', teamId: 'team-moon' }, { series: { ...WORK, id: 'work-77', title: 'Solo Leveling' }, myTeams: [MOON_SCANS] });
      await whenIGoToTheChapterSetupOfTheSeries([{ number: '5', team: { id: 'team-moon', name: 'Moon Scans' } }]);

      whenITypeTheChapterNumber('5');

      thenTheChapterStepSays('Moon Scans already published chapter 5 of Solo Leveling. Choose another number.');
      thenICannotClick('Next: Upload Pages');
    });

    it('refuses a link made for a team I am not on', async () => {
      await givenIOpenedTheStudioFor({ workId: 'work-77', teamId: 'team-shadow' }, { series: { ...WORK, id: 'work-77' }, myTeams: [MOON_SCANS] });

      thenTheAlertSays('You are not on the team this link was made for.');
      thenThereIsNoWizard();
    });

    it('a new series can belong to a team I lead', async () => {
      await givenILeadTheTeams([MOON_SCANS]);
      whenIChooseTheTeam('team-moon');
      await givenIAmOnTheReview({ series: { title: 'Blue Lock' }, chapter: { number: '1' }, pages: ['p1.png'] });

      await whenIPublish();
      await whenTheSeriesIsCreated(WORK);

      thenTheSeriesWasCreatedForTheTeam('team-moon');

      await whenEveryPageUploads();
      await whenTheChapterIsPublished(CHAPTER, [{ id: 'proj-moon', teamId: 'team-moon', boardEnabled: true }]);

      thenThePublishedChapterIncludes({ teamId: 'team-moon' });
    });

    it('without a team I lead, I am asked to start one before creating a series', async () => {
      await givenILeadTheTeams([]);

      thenThereIsNoTeamChoice();
      thenICanSee('A new series belongs to a team you lead.');
      thenThereIsALinkTo('/scanlation');
    });

    async function givenIOpenedTheStudioFor(link: { workId: string; teamId: string }, server: { series: typeof WORK; myTeams: (typeof MOON_SCANS)[] }): Promise<void> {
      workId = link.workId;
      fixture.componentRef.setInput('workId', link.workId);
      fixture.componentRef.setInput('teamId', link.teamId);
      await settleStudio();
      http.expectOne(`${API}/works/${link.workId}`).flush(ok(server.series));
      http.expectOne(`${API}/teams/mine`).flush(ok(server.myTeams));
      await settleStudio();
    }

    /** `/upload` with no series picked and "create" not chosen: the "Which series?" step, which loads my teams. */
    async function givenIOpenTheStudioWithoutASeries(server: { myTeams: (typeof MOON_SCANS)[] }): Promise<void> {
      await givenIAmSignedInWith(['LIBRARY_USE']);
      fixture.componentRef.setInput('create', undefined);
      await settleStudio();
      http.expectOne(`${API}/teams/mine`).flush(ok(server.myTeams));
      await settleStudio();
    }

    async function whenISearchTheCatalogFor(text: string, found: (typeof SOLO_LEVELING)[]): Promise<void> {
      typeInto('#which-series-text', text);
      clickButton('Search the catalog');
      await settleStudio();
      http.expectOne((r) => r.url === `${API}/works` && r.params.get('q') === text).flush(ok({ items: found, page: 0, size: 8, totalElements: found.length, totalPages: 1 }));
      await settleStudio();
    }

    async function whenIChooseToCreateANewSeries(): Promise<void> {
      await whenIChoose('Create a new series');
    }

    async function whenIChoose(label: string): Promise<void> {
      clickButton(label);
      await settleStudio();
    }

    async function whenIAddTheSeriesToMyTeamAndPublish(label: string): Promise<void> {
      clickButton(label);
      await settleStudio();
      lastAdd = http.expectOne((r) => r.method === 'POST' && r.url.startsWith(`${API}/teams/`));
      lastAdd.flush(ok({ id: 'proj-new', name: 'Moon Scans - Solo Leveling', workId: 'work-11', teamId: 'team-moon', tasks: [] }));
      await settleStudio();
    }

    /** The title field looks for similar series 400 ms after the last key. */
    async function whenITypeTheTitleAndPause(title: string, similar: (typeof SOLO_LEVELING)[]): Promise<void> {
      whenITypeTheTitle(title);
      await vi.advanceTimersByTimeAsync(400);
      http.expectOne((r) => r.url === `${API}/works` && r.params.get('q') === title).flush(ok({ items: similar, page: 0, size: 3, totalElements: similar.length, totalPages: 1 }));
      await settleStudio();
    }

    function thenTheFoundSeriesAre(titles: string[]): void {
      expect(Array.from(page().querySelectorAll('.results app-work-card .title')).map((a) => a.textContent!.trim())).toEqual(titles);
    }

    function thenTheSearchSummarySays(text: string): void {
      expect(page().querySelector('.result-summary')!.textContent!.trim()).toBe(text);
    }

    async function thenIAmSentTo(url: string): Promise<void> {
      await settleStudio();
      expect(TestBed.inject(Router).url).toBe(url);
    }

    function thenTheSeriesWasAddedTo(teamId: string, workId: string): void {
      expect(lastAdd.request.url).toBe(`${API}/teams/${teamId}/series`);
      expect(lastAdd.request.body).toEqual({ workId });
    }

    function thenTheSimilarSeriesAre(titles: string[]): void {
      const similar = page().querySelector('.similar-series')!;
      expect(similar.textContent).toContain('Readora already has a series with a title like this:');
      expect(Array.from(similar.querySelectorAll('li')).map((li) => li.textContent!.trim())).toEqual(titles);
    }

    function thenTheChapterStepSays(text: string): void {
      expect(page().querySelector('.versions')!.textContent!.replace(/\s+/g, ' ')).toContain(text);
    }

    function thenTheOtherVersionsAre(teams: string[]): void {
      expect(Array.from(page().querySelectorAll('.versions li')).map((li) => li.textContent!.trim())).toEqual(teams);
    }

    async function givenILeadTheTeams(teams: (typeof MOON_SCANS)[]): Promise<void> {
      myTeamsLoaded = true;
      await givenIAmSignedInWith(['LIBRARY_USE']);
      await settleStudio();
      http.expectOne(`${API}/teams/mine`).flush(ok(teams));
      await settleStudio();
    }

    async function whenIFillTheChapterAndPages(chapter: { number: string; pages: string[] }): Promise<void> {
      await whenIGoToTheChapterSetupOfTheSeries();
      whenITypeTheChapterNumber(chapter.number);
      whenIGoToThePages();
      await whenIAddPages(...chapter.pages);
      whenIGoToTheReview();
    }

    /** The chapter step lists the versions other teams already published (`GET /works/{id}/chapters`). */
    async function whenIGoToTheChapterSetupOfTheSeries(published: { number: string; team: { id: string; name: string } }[] = []): Promise<void> {
      clickButton('Next: Chapter Setup');
      await settleStudio();
      http
        .expectOne(`${API}/works/${workId}/chapters`)
        .flush(ok(published.map((c, i) => ({ ...CHAPTER, id: `published-${i}`, workId, chapterNumber: c.number, pageCount: 1, publishedAt: null, team: c.team }))));
      await settleStudio();
    }

    async function whenIPublishTheChapter(): Promise<void> {
      clickButton('Publish chapter');
      await settleStudio();
    }

    function whenIChooseTheTeam(teamId: string): void {
      const select = page().querySelector<HTMLSelectElement>('#manga-team')!;
      select.value = teamId;
      select.dispatchEvent(new Event('input'));
      fixture.detectChanges();
    }

    function thenTheStepSays(text: string): void {
      expect(page().querySelector('.wizard-card')!.textContent!.replace(/\s+/g, ' ')).toContain(text);
    }

    function thenThereIsNoWizard(): void {
      expect(page().querySelector('.wizard-card')).toBeNull();
    }

    function thenThereIsNoTeamChoice(): void {
      expect(page().querySelector('#manga-team')).toBeNull();
    }

    function thenICanSee(text: string): void {
      expect(page().textContent).toContain(text);
    }

    function thenThereIsALinkTo(href: string): void {
      expect(Array.from(page().querySelectorAll('a')).map((a) => a.getAttribute('href'))).toContain(href);
    }

    function thenTheSeriesWasCreatedForTheTeam(teamId: string): void {
      expect(workRequest.request.body).toMatchObject({ teamId });
    }
  });

  describe('publish failures and retries (HTTP level)', () => {
    it('retries only the failed page and reuses the already created Work', async () => {
      await givenIAmOnTheReview({ series: { title: 'Blue Lock' }, chapter: { number: '3' }, pages: ['p1.png', 'p2.png'] });

      await whenIPublish();
      await whenTheSeriesIsCreated(WORK);
      await whenThePageUploadsAnswer([
        { storageKey: 'k1', cdnUrl: 'https://cdn/k1', liteCdnUrl: 'https://cdn/k1.lite.jpg' },
        { rejectedWith: 'Storage unavailable' }
      ]);

      thenPageUploadsWereSent(2);
      thenThePagesWentToTheFolder('scans/work-1/c3');
      thenTheStepIs('4. Review & Confirmation');
      thenTheAlertSays('1 of 2 pages failed to upload');
      thenTheRetryHintMentions('Blue Lock');

      await whenIPublish();

      thenTheSeriesWasNotCreatedAgain();

      await whenThePageUploadsAnswer([{ storageKey: 'k2', cdnUrl: 'https://cdn/k2' }]);

      thenPageUploadsWereSent(1);

      await whenTheChapterIsPublished(CHAPTER);

      thenThePublishedChapterIs({
        teamId: 'team-1',
        chapterNumber: '3',
        title: undefined,
        pages: [
          { pageNumber: 1, storageKey: 'k1', cdnUrl: 'https://cdn/k1', width: 800, height: 1200, description: undefined, liteCdnUrl: 'https://cdn/k1.lite.jpg' },
          { pageNumber: 2, storageKey: 'k2', cdnUrl: 'https://cdn/k2', width: 800, height: 1200 }
        ]
      });
      thenTheStepIs(SUCCESS);
      thenTheFirstSuccessLinkIs('/read/chap-1');
    });

    it('surfaces the API message when creating the Work fails, and retries it', async () => {
      await givenIAmOnTheReview({ series: { title: 'Blue Lock' }, chapter: { number: '3' }, pages: ['p1.png', 'p2.png'] });

      await whenIPublish();
      await whenCreatingTheSeriesFails('Title already exists', 409);

      thenTheAlertSays('Title already exists');
      thenThereIsNoRetryHint();

      await whenIPublish();
      await whenTheSeriesIsCreated(WORK);
      await whenEveryPageUploads();
      await whenTheChapterIsPublished(CHAPTER);

      thenTheStepIs(SUCCESS);
    });
  });

  describe('scanlation mode', () => {
    it('reports a failed project lookup instead of swallowing it', async () => {
      await givenIAmOnTheReview({ series: { title: 'Blue Lock' }, chapter: { number: '3' }, pages: ['p1.png', 'p2.png'], mode: 'SCANLATION' });

      await whenIPublish();
      await whenTheSeriesIsCreated(WORK);
      await whenEveryPageUploads();
      await whenTheProjectLookupFails('Access denied');

      thenTheStepIs('4. Review & Confirmation');
      thenTheAlertSays('Access denied');
    });

    it("a series whose task board is off gets it turned on before the chapter goes on it", async () => {
      await givenIAmOnTheReview({ series: { title: 'Blue Lock' }, chapter: { number: '3' }, pages: ['p1.png', 'p2.png'], mode: 'SCANLATION' });

      await whenIPublish();
      await whenTheSeriesIsCreated(WORK);
      await whenEveryPageUploads();
      await whenTheSeriesHasProjects([{ id: 'proj-1', teamId: 'team-1', boardEnabled: false }]);
      await whenTheBoardIsTurnedOn('proj-1');
      await whenTheTaskIsCreated();

      thenTheBoardWasTurnedOn();
      thenTheTaskWasCreatedWith({ chapterNumber: 3, pages: [uploadedPage(1, 'k0'), uploadedPage(2, 'k1')] });
      thenTheStepIs(SUCCESS);
    });

    it('a member who may not turn the task board on is told so, and nothing goes on the board', async () => {
      await givenIAmOnTheReview({ series: { title: 'Blue Lock' }, chapter: { number: '3' }, pages: ['p1.png', 'p2.png'], mode: 'SCANLATION' });

      await whenIPublish();
      await whenTheSeriesIsCreated(WORK);
      await whenEveryPageUploads();
      await whenTheSeriesHasProjects([{ id: 'proj-1', teamId: 'team-1', boardEnabled: false }]);
      await whenTurningTheBoardOnIsRefused('proj-1', 'Only a leader of My Team can do this');

      thenTheStepIs('4. Review & Confirmation');
      thenTheAlertSays("You don't have permission to do this.");
    });

    it('explains when the series has no project, then creates the task on retry', async () => {
      await givenIAmOnTheReview({ series: { title: 'Blue Lock' }, chapter: { number: '3' }, pages: ['p1.png', 'p2.png'], mode: 'SCANLATION' });

      await whenIPublish();
      await whenTheSeriesIsCreated(WORK);
      await whenEveryPageUploads();
      await whenTheSeriesHasProjects([]);

      thenTheAlertSays('Your team does not work on this series yet');

      await whenIPublish();
      await whenTheSeriesHasProjects([{ id: 'proj-1', teamId: 'team-1', boardEnabled: true }]);
      await whenTheTaskIsCreated();

      thenTheTaskWasCreatedWith({ chapterNumber: 3, pages: [uploadedPage(1, 'k0'), uploadedPage(2, 'k1')] });
      thenTheStepIs(SUCCESS);
      thenASuccessLinkIs('/scanlation/proj-1');
    });
  });

  describe('object URL lifecycle', () => {
    it('revokes the cover preview when it is changed or removed', () => {
      whenIPickTheCover('a.png');

      thenTheCoverPreviewIs('blob:test/1');

      whenIRemoveTheCover();

      thenTheRevokedUrlsAre(['blob:test/1']);

      whenIPickTheCover('b.png');
      whenIRemoveTheCover();

      thenTheRevokedUrlsAre(['blob:test/1', 'blob:test/2']);
      thenThereIsNoCoverPreview();
    });

    it('revokes cover and page previews when starting over, and on destroy', async () => {
      givenIPickedTheCover('a.png');
      await givenIAmOnTheReview({ series: { title: 'Blue Lock' }, chapter: { number: '3' }, pages: ['p1.png', 'p2.png'] });
      await givenIPublishedEverything();

      await whenIStartOver();

      thenEveryPreviewCreatedBeforeStartingOverWasRevoked();
      thenTheStepIs('1. Manga / Series Information');

      whenIChooseMyTeam();
      whenIPickTheCover('b.png');
      whenITypeTheTitle('Again');
      await whenIGoToTheChapterSetup();
      whenIGoToThePages();
      await whenIAddPages('p9.png');
      whenILeaveTheStudio();

      thenEveryPreviewWasRevoked();
    });

    function givenIPickedTheCover(name: string): void {
      whenIPickTheCover(name);
    }

    async function givenIPublishedEverything(): Promise<void> {
      await whenIPublish();
      http.expectOne(`${API}/storage/upload?folder=covers`).flush(ok({ storageKey: 'c', cdnUrl: 'https://cdn/c' }));
      await settleStudio();
      await whenTheSeriesIsCreated(WORK);
      await whenEveryPageUploads();
      await whenTheChapterIsPublished(CHAPTER);
    }

    /** Picks a cover through the cover picker's (visually hidden) file input. */
    function whenIPickTheCover(name: string): void {
      const input: HTMLInputElement = page().querySelector('app-cover-picker input[type="file"]')!;
      Object.defineProperty(input, 'files', { value: [new File(['x'], name, { type: 'image/png' })], configurable: true });
      input.dispatchEvent(new Event('change'));
      fixture.detectChanges();
    }

    function whenIRemoveTheCover(): void {
      clickButton('Change Cover');
    }

    /** The series step starts afresh and loads my teams again. */
    async function whenIStartOver(): Promise<void> {
      createdBeforeStartingOver = [...created];
      clickButton('Upload Another Manga');
      await settleStudio();
      http.expectOne(`${API}/teams/mine`).flush(ok([MY_TEAM]));
      await settleStudio();
    }

    function whenILeaveTheStudio(): void {
      fixture.destroy();
    }

    function thenTheCoverPreviewIs(src: string): void {
      expect(page().querySelector('app-cover-picker img')!.getAttribute('src')).toBe(src);
    }

    function thenThereIsNoCoverPreview(): void {
      expect(page().querySelector('app-cover-picker img')).toBeNull();
    }

    function thenTheRevokedUrlsAre(urls: string[]): void {
      expect(revoked).toEqual(urls);
    }

    function thenEveryPreviewCreatedBeforeStartingOverWasRevoked(): void {
      expect(revoked).toEqual(createdBeforeStartingOver);
    }

    function thenEveryPreviewWasRevoked(): void {
      expect(revoked).toEqual(created);
    }
  });

  /** The series step with my team chosen (unless a test chose one already). */
  async function givenIOpenTheStudio(): Promise<void> {
    await givenILeadMyTeam();
    if (!page().querySelector<HTMLSelectElement>('#manga-team')?.value) {
      whenIChooseMyTeam();
    }
  }

  function whenIChooseMyTeam(): void {
    const team = page().querySelector<HTMLSelectElement>('#manga-team')!;
    team.value = MY_TEAM.id;
    team.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  /** A new series belongs to a team I lead: signed in as the leader of "My Team" (once per test). */
  async function givenILeadMyTeam(): Promise<void> {
    await settleStudio();
    if (myTeamsLoaded) {
      return;
    }
    myTeamsLoaded = true;
    await givenIAmSignedInWith(['LIBRARY_USE']);
    await settleStudio();
    http.expectOne(`${API}/teams/mine`).flush(ok([MY_TEAM]));
    await settleStudio();
  }

  async function givenIAmOnTheChapterSetupOf(title: string): Promise<void> {
    await givenIOpenTheStudio();
    whenITypeTheTitle(title);
    await whenIGoToTheChapterSetup();
  }

  /** Fills the three steps as the user does, up to the review step. */
  async function givenIAmOnTheReview(draft: Draft): Promise<void> {
    await givenIOpenTheStudio();
    typeSeries(draft.series);
    clickButton('Next: Chapter Setup');
    whenITypeTheChapterNumber(draft.chapter.number);
    if (draft.chapter.title !== undefined) {
      typeInto('#chapter-title', draft.chapter.title);
    }
    if (draft.mode === 'SCANLATION') {
      page().querySelector<HTMLInputElement>('input[value="SCANLATION"]')!.click();
      fixture.detectChanges();
    }
    whenIGoToThePages();
    await whenIAddPages(...draft.pages);
    whenIGoToTheReview();
  }

  function whenITypeTheTitle(title: string): void {
    typeInto('#manga-title', title);
  }

  function whenITypeTheFacts(facts: { otherTitles?: string; artist?: string; year?: string; language?: string }): void {
    const fields: [string, string | undefined][] = [
      ['#facts-titles', facts.otherTitles],
      ['#facts-artist', facts.artist],
      ['#facts-year', facts.year],
      ['#facts-language', facts.language]
    ];
    fields.filter(([, value]) => value !== undefined).forEach(([selector, value]) => typeInto(selector, value!));
  }

  function whenITypeTheChapterNumber(chapterNumber: string): void {
    typeInto('#chapter-number', chapterNumber);
  }

  async function whenIGoToTheChapterSetup(): Promise<void> {
    clickButton('Next: Chapter Setup');
    await settleStudio();
  }

  function whenIGoToThePages(): void {
    clickButton('Next: Upload Pages');
  }

  function whenIGoToTheReview(): void {
    clickButton('Next: Review');
  }

  function whenIChoosePublishingMode(position: number): void {
    publishingModes()[position - 1].click();
    fixture.detectChanges();
  }

  function whenIToggleTheGenres(...names: string[]): void {
    names.forEach((name) => genrePill(name).click());
    fixture.detectChanges();
  }

  function whenIAddTheCustomGenre(name: string): void {
    typeInto('input[aria-label="Custom genre"]', name);
    clickButton('Add');
  }

  function whenIJumpToStep(step: number): void {
    stepButtons()[step - 1].click();
    fixture.detectChanges();
  }

  async function whenIAddPages(...names: string[]): Promise<void> {
    choosePageFiles(page(), names);
    await settleStudio();
  }

  async function whenIPublish(): Promise<void> {
    clickButton('Publish Series');
    await settleStudio();
  }

  async function whenTheSeriesIsCreated(work: typeof WORK): Promise<void> {
    workId = work.id;
    workRequest = http.expectOne({ method: 'POST', url: `${API}/works` });
    workRequest.flush(ok(work));
    await settleStudio();
  }

  async function whenCreatingTheSeriesFails(error: string, status: number): Promise<void> {
    http.expectOne(`${API}/works`).flush(fail(error), { status, statusText: 'Failure' });
    await settleStudio();
  }

  async function whenEveryPageUploads(): Promise<void> {
    uploads().forEach((r, i) => r.flush(ok({ storageKey: `k${i}`, cdnUrl: `https://cdn/k${i}` })));
    await settleStudio();
  }

  async function whenThePageUploadsAnswer(answers: PageAnswer[]): Promise<void> {
    pageUploads = uploads();
    pageUploads.forEach((request, i) => answerUpload(request, answers[i]));
    await settleStudio();
  }

  /** The publishing team's board is looked up first: the chapter is published for that team. */
  async function whenTheChapterIsPublished(chapter: typeof CHAPTER, boards: Board[] = [{ id: 'proj-1', teamId: 'team-1', boardEnabled: true }]): Promise<void> {
    await whenTheSeriesHasProjects(boards);
    chapterRequest = http.expectOne(`${API}/works/${workId}/chapters/direct`);
    chapterRequest.flush(ok(chapter));
    await settleStudio();
  }

  async function whenTheProjectLookupFails(error: string): Promise<void> {
    http.expectOne(`${API}/works/${workId}/projects`).flush(fail(error), { status: 403, statusText: 'Forbidden' });
    await settleStudio();
  }

  async function whenTheSeriesHasProjects(projects: Board[]): Promise<void> {
    http.expectOne(`${API}/works/${workId}/projects`).flush(ok(projects));
    await settleStudio();
  }

  async function whenTheBoardIsTurnedOn(projectId: string): Promise<void> {
    boardRequest = http.expectOne(`${API}/scanlation/projects/${projectId}/board`);
    boardRequest.flush(ok({ id: projectId, name: 'Board', workId, teamId: 'team-1', teamName: 'My Team', boardEnabled: true, members: [], tasks: [] }));
    await settleStudio();
  }

  async function whenTurningTheBoardOnIsRefused(projectId: string, error: string): Promise<void> {
    http.expectOne(`${API}/scanlation/projects/${projectId}/board`).flush(fail(error, 'FORBIDDEN'), { status: 403, statusText: 'Forbidden' });
    await settleStudio();
  }

  function thenTheBoardWasTurnedOn(): void {
    expect(boardRequest.request.method).toBe('PUT');
    expect(boardRequest.request.body).toEqual({ enabled: true });
  }

  async function whenTheTaskIsCreated(): Promise<void> {
    taskRequest = http.expectOne((r) => r.method === 'POST' && r.url.endsWith('/tasks'));
    taskRequest.flush(ok({ id: 'task-1' }));
    await settleStudio();
  }

  function thenTheStepIs(heading: string): void {
    expect(page().querySelector('.wizard-card h2')?.textContent?.trim() ?? '').toBe(heading);
  }

  function thenTheSeriesTypeIs(type: string): void {
    expect(page().querySelector<HTMLSelectElement>('#manga-type')!.value).toBe(type);
  }

  function thenTheSeriesStatusIs(status: string): void {
    expect(page().querySelector<HTMLSelectElement>('#manga-status')!.value).toBe(status);
  }

  function thenICannotClick(label: string): void {
    expect(button(label).disabled).toBe(true);
  }

  function thenTheTitleErrorSays(text: string): void {
    expect(page().querySelector('#manga-title-error')!.textContent).toContain(text);
  }

  function thenTheChapterNumberIs(chapterNumber: string): void {
    expect(page().querySelector<HTMLInputElement>('#chapter-number')!.value).toBe(chapterNumber);
  }

  function thenTheChapterNumberParsesAs(input: string, chapterNumber: string): void {
    expect(parseChapterNumber(input)).toBe(chapterNumber);
  }

  function thenTheChapterNumbersAreRejected(...inputs: string[]): void {
    inputs.forEach((input) => expect(parseChapterNumber(input)).toBeNull());
  }

  function thenTheChapterNumberIsMarkedInvalid(): void {
    expect(page().querySelector('#chapter-number')!.getAttribute('aria-invalid')).toBe('true');
  }

  function thenTheChapterNumberErrorSays(text: string): void {
    expect(page().querySelector('#chapter-number-error')!.textContent).toContain(text);
  }

  function thenISeeTheFieldGroup(legend: string): void {
    expect(Array.from(page().querySelectorAll('legend')).map((l) => l.textContent?.trim())).toContain(legend);
  }

  function thenThereArePublishingModes(count: number): void {
    expect(publishingModes().length).toBe(count);
  }

  function thenPublishingModeIsChecked(position: number): void {
    expect(publishingModes()[position - 1].checked).toBe(true);
  }

  function thenModeCardIsSelected(position: number): void {
    expect(page().querySelectorAll('.mode-card')[position - 1].classList).toContain('selected');
  }

  function thenGenreIsPressed(name: string): void {
    expect(genrePill(name).getAttribute('aria-pressed')).toBe('true');
  }

  function thenGenreIsNotPressed(name: string): void {
    expect(genrePill(name).getAttribute('aria-pressed')).toBe('false');
  }

  function thenTheReviewSummaryShows(text: string): void {
    expect(page().querySelector('.review-summary')?.textContent).toContain(text);
  }

  function thenTheStepButtonsDisabledAre(disabled: boolean[]): void {
    expect(stepButtons().map((b) => b.disabled)).toEqual(disabled);
  }

  function thenStepIsCurrent(step: number): void {
    expect(stepButtons()[step - 1].getAttribute('aria-current')).toBe('step');
  }

  function thenStepIsCompleted(step: number): void {
    expect(stepButtons()[step - 1].classList.contains('completed')).toBe(true);
  }

  function thenTheSeriesWasCreatedWithTheFacts(facts: object): void {
    expect(workRequest.request.body.facts).toEqual(facts);
  }

  function thenICannotGoToTheChapterSetup(): void {
    const next = Array.from(page().querySelectorAll('button')).find((button) => button.textContent!.includes('Next: Chapter Setup'))!;
    expect(next.disabled).toBe(true);
  }

  function thenTheSeriesWasCreatedWith(fields: SeriesDraft): void {
    expect(workRequest.request.body).toMatchObject(fields);
  }

  function thenTheSeriesWasNotCreatedAgain(): void {
    http.expectNone({ method: 'POST', url: `${API}/works` });
  }

  function thenThePublishedChapterIncludes(fields: Record<string, unknown>): void {
    expect(chapterRequest.request.body).toMatchObject(fields);
  }

  function thenThePublishedChapterIs(body: Record<string, unknown>): void {
    expect(chapterRequest.request.body).toEqual(body);
  }

  function thenPageUploadsWereSent(count: number): void {
    expect(pageUploads.length).toBe(count);
  }

  function thenThePagesWentToTheFolder(folder: string): void {
    expect(pageUploads[0].request.urlWithParams).toContain(encodeURIComponent(folder));
  }

  function thenTheTaskWasCreatedWith(body: CreateTaskRequest): void {
    expect(taskRequest.request.body).toEqual(body);
  }

  function uploadedPage(pageNumber: number, key: string): PagePayload {
    return { pageNumber, storageKey: key, cdnUrl: `https://cdn/${key}`, width: 800, height: 1200 };
  }

  function thenTheSuccessLinksAre(hrefs: string[]): void {
    expect(successLinks()).toEqual(hrefs);
  }

  function thenTheFirstSuccessLinkIs(href: string): void {
    expect(page().querySelector('.success-actions a')?.getAttribute('href')).toBe(href);
  }

  function thenASuccessLinkIs(href: string): void {
    expect(successLinks()).toContain(href);
  }

  function thenTheAlertSays(text: string): void {
    expect(page().querySelector('.studio-alert')?.textContent ?? '').toContain(text);
  }

  function thenTheRetryHintMentions(text: string): void {
    expect(page().querySelector('.retry-hint')?.textContent).toContain(text);
  }

  function thenThereIsNoRetryHint(): void {
    expect(page().querySelector('.retry-hint')).toBeNull();
  }

  function thenTheProgressBarRunsFrom(min: number, max: number): void {
    expect(progressBar().getAttribute('aria-valuemin')).toBe(String(min));
    expect(progressBar().getAttribute('aria-valuemax')).toBe(String(max));
  }

  function thenTheProgressIsAboveZero(): void {
    expect(Number(progressBar().getAttribute('aria-valuenow'))).toBeGreaterThan(0);
  }

  function thenTheProgressSays(text: string): void {
    expect(progressBar().getAttribute('aria-valuetext')).toContain(text);
  }

  function typeSeries(series: SeriesDraft): void {
    whenITypeTheTitle(series.title);
    const optionalFields: [string, string | undefined][] = [
      ['#manga-author', series.author],
      ['#manga-demographic', series.demographic],
      ['#manga-synopsis', series.synopsis]
    ];
    optionalFields.filter(([, value]) => value !== undefined).forEach(([selector, value]) => typeInto(selector, value!));
  }

  function answerUpload(request: TestRequest, answer: PageAnswer): void {
    if ('rejectedWith' in answer) {
      request.flush(fail(answer.rejectedWith), { status: 503, statusText: 'Service Unavailable' });
    } else {
      request.flush(ok(answer));
    }
  }

  async function settleStudio(): Promise<void> {
    for (let i = 0; i < 6; i++) {
      await Promise.resolve();
    }
    fixture.detectChanges();
  }

  function typeInto(selector: string, value: string): void {
    const field = page().querySelector(selector) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
    field.value = value;
    field.dispatchEvent(new Event('input'));
    field.dispatchEvent(new Event('change'));
    field.dispatchEvent(new Event('blur'));
    fixture.detectChanges();
  }

  function clickButton(label: string): void {
    button(label).click();
    fixture.detectChanges();
  }

  function page(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function button(label: string): HTMLButtonElement {
    const found = Array.from(page().querySelectorAll('button')).find((b) => b.textContent?.includes(label));
    if (!found) throw new Error(`No button "${label}"`);
    return found;
  }

  function genrePill(name: string): HTMLButtonElement {
    return Array.from(page().querySelectorAll<HTMLButtonElement>('.genre-pill')).find((b) => b.textContent?.trim() === name)!;
  }

  function publishingModes(): NodeListOf<HTMLInputElement> {
    return page().querySelectorAll<HTMLInputElement>('input[type="radio"][name="publishing-mode"]');
  }

  function stepButtons(): HTMLButtonElement[] {
    return Array.from(page().querySelectorAll<HTMLButtonElement>('app-wizard-steps button'));
  }

  function progressBar(): HTMLElement {
    return page().querySelector<HTMLElement>('[role="progressbar"]')!;
  }

  function successLinks(): (string | null)[] {
    return Array.from(page().querySelectorAll('.success-actions a')).map((a) => a.getAttribute('href'));
  }

  function uploads(): TestRequest[] {
    return http.match((r) => r.url.startsWith(`${API}/storage/upload`));
  }
});
