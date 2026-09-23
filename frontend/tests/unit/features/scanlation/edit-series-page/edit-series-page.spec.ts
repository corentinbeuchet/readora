import { TestBed } from '@angular/core/testing';
import { HttpTestingController, TestRequest } from '@angular/common/http/testing';
import { Router, provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Work, WorkSummary } from '@app/core/models/catalog';
import { MyTeam } from '@app/core/models/scanlation';
import { EditSeriesPage } from '@app/features/scanlation/edit-series-page/edit-series-page';
import { MyTeamsPage } from '@app/features/scanlation/my-teams-page/my-teams-page';
import { givenIAmSignedInWith } from '../../../core/auth/auth-fixtures';
import { API, BlankPage, fail, ok, provideHttpTesting, settle } from '../../../test-utils';

const SOLO_LEVELING: Work = {
  id: 'w-1',
  title: 'Solo Leveling',
  synopsis: 'A hunter levels up.',
  type: 'MANHWA',
  status: 'COMPLETED',
  author: 'Chugong',
  demographic: 'SHOUNEN',
  coverImageUrl: '/api/v1/storage/assets/covers/w-1.webp',
  genres: ['Action', 'Fantasy'],
  facts: { alternativeTitles: ['Na Honjaman Level Up'], artist: null, releaseYear: 2018, originalLanguage: 'KOREAN', contentRating: null }
};
const SUMMARY: WorkSummary = { id: 'w-1', title: 'Solo Leveling', type: 'MANHWA', status: 'COMPLETED', author: 'Chugong', demographic: 'SHOUNEN', coverImageUrl: null, genres: [] };
const MY_TEAM: MyTeam = { id: 't-1', name: 'Moon Scans', description: null, myRoles: ['LEADER'], boards: [{ projectId: 'p-1', work: SUMMARY }] };

describe('EditSeriesPage (US-04)', () => {
  let harness: RouterTestingHarness;
  let http: HttpTestingController;
  let lastRequest: TestRequest;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [
        provideRouter(
          [
            { path: 'scanlation', component: MyTeamsPage },
            { path: 'scanlation/series/:workId', component: EditSeriesPage },
            { path: '**', component: BlankPage }
          ],
          withComponentInputBinding()
        ),
        ...provideHttpTesting()
      ]
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('A team leader edits the series from the team workspace', async () => {
    await givenIAmInMyTeamWorkspace(MY_TEAM);

    await whenIOpenEditSeries({ of: 'Solo Leveling', loaded: SOLO_LEVELING });
    await whenIType('Artist', 'DUBU');
    await whenISaveTheSeries({ answered: { ...SOLO_LEVELING, facts: { ...SOLO_LEVELING.facts, artist: 'DUBU' } } });

    thenTheRequestWas('PUT', `${API}/works/w-1`);
    thenTheSavedFactsAre({ alternativeTitles: ['Na Honjaman Level Up'], artist: 'DUBU', releaseYear: 2018, originalLanguage: 'KOREAN' });
    thenIAmOn('/works/w-1');
  });

  it('the form starts with what the series page says today', async () => {
    await givenIEditTheSeries(SOLO_LEVELING);

    thenTheFieldIs('Title', 'Solo Leveling');
    thenTheFieldIs('Genres', 'Action, Fantasy');
    thenTheFieldIs('Other titles', 'Na Honjaman Level Up');
    thenTheFieldIs('First published (year)', '2018');
    thenTheFieldIs('Original language', 'KOREAN');
    thenTheFieldIs('Content rating', '');
  });

  it('saving sends the whole description back, the untouched cover included, and never who I am', async () => {
    await givenIEditTheSeries(SOLO_LEVELING);

    await whenIType('Genres', 'Action,  Fantasy, action , Drama');
    await whenISaveTheSeries({ answered: SOLO_LEVELING });

    thenTheRequestBodyHas({ title: 'Solo Leveling', type: 'MANHWA', status: 'COMPLETED', author: 'Chugong', demographic: 'SHOUNEN' });
    thenTheRequestBodyHas({ coverImageUrl: '/api/v1/storage/assets/covers/w-1.webp', genres: ['Action', 'Fantasy', 'action', 'Drama'] });
    thenTheRequestNeverSaysWhoIAm();
  });

  it('a year that is not a year is refused before anything is sent', async () => {
    await givenIEditTheSeries(SOLO_LEVELING);

    await whenIType('First published (year)', '18');
    await whenISubmitTheForm();

    thenTheFieldIsInvalidWith('First published (year)', 'Enter a year between 1900 and 2100, or leave it empty');
    thenIAmOn('/scanlation/series/w-1');
  });

  it('more than ten other titles are refused before anything is sent', async () => {
    await givenIEditTheSeries(SOLO_LEVELING);

    await whenIType('Other titles', Array.from({ length: 11 }, (_, n) => `Title ${n + 1}`).join('\n'));
    await whenISubmitTheForm();

    thenTheFieldIsInvalidWith('Other titles', 'A series has at most 10 other titles');
  });

  it('a series without a title is refused before anything is sent', async () => {
    await givenIEditTheSeries(SOLO_LEVELING);

    await whenIType('Title', '   ');
    await whenISubmitTheForm();

    thenTheFieldIsInvalidWith('Title', 'Give the series a title');
  });

  it('says so when the server refuses the edit, and keeps what I typed', async () => {
    await givenIEditTheSeries(SOLO_LEVELING);
    await whenIType('Artist', 'DUBU');

    await whenTheServerRefusesTheSave({ code: 'FORBIDDEN' });

    thenISeeTheAlert("You don't have permission to do this.");
    thenTheFieldIs('Artist', 'DUBU');
    thenIAmOn('/scanlation/series/w-1');
  });

  it('a series that does not exist says so and leads back to my teams', async () => {
    await givenTheSeriesDoesNotExist('w-404');

    thenISeeTheAlert("This series doesn't exist.");
    thenThereIsALinkTo('/scanlation');
  });

  async function givenIAmInMyTeamWorkspace(team: MyTeam): Promise<void> {
    await givenIAmSignedInWith(['LIBRARY_USE']);
    harness = await RouterTestingHarness.create();
    const opening = harness.navigateByUrl('/scanlation');
    await settle(harness);
    http.expectOne(`${API}/teams/mine`).flush(ok([team]));
    http.expectOne(`${API}/invitations/mine`).flush(ok([]));
    await opening;
    await settle(harness);
    // The panel lists the team's members and, for a leader, the invitations waiting for an answer (none here).
    http.match((request) => request.url.endsWith('/invitations')).forEach((request) => request.flush(ok([])));
    http.match((request) => /\/teams\/[^/]+$/.test(request.url)).forEach((request) => request.flush(ok(null)));
    await settle(harness);
  }

  async function givenIEditTheSeries(work: Work): Promise<void> {
    await givenIAmSignedInWith(['LIBRARY_USE']);
    harness = await RouterTestingHarness.create();
    const opening = harness.navigateByUrl(`/scanlation/series/${work.id}`);
    await settle(harness);
    http.expectOne(`${API}/works/${work.id}`).flush(ok(work));
    await opening;
    await settle(harness);
  }

  async function givenTheSeriesDoesNotExist(workId: string): Promise<void> {
    await givenIAmSignedInWith(['LIBRARY_USE']);
    harness = await RouterTestingHarness.create();
    const opening = harness.navigateByUrl(`/scanlation/series/${workId}`);
    await settle(harness);
    http.expectOne(`${API}/works/${workId}`).flush(fail('Work not found'), { status: 404, statusText: 'Not Found' });
    await opening;
    await settle(harness);
  }

  async function whenIOpenEditSeries(series: { of: string; loaded: Work }): Promise<void> {
    link(`Edit series: ${series.of}`).click();
    await settle(harness);
    http.expectOne(`${API}/works/${series.loaded.id}`).flush(ok(series.loaded));
    await settle(harness);
  }

  async function whenIType(label: string, text: string): Promise<void> {
    const control = field(label);
    control.value = text;
    control.dispatchEvent(new Event('input'));
    control.dispatchEvent(new Event('blur'));
    await settle(harness);
  }

  async function whenISubmitTheForm(): Promise<void> {
    form().dispatchEvent(new Event('submit', { cancelable: true }));
    await settle(harness);
  }

  async function whenISaveTheSeries(save: { answered: Work }): Promise<void> {
    await whenISubmitTheForm();
    lastRequest = http.expectOne(`${API}/works/${save.answered.id}`);
    lastRequest.flush(ok(save.answered));
    await settle(harness);
  }

  /** Errors are shown by their code (US-13), not by the server's English sentence. */
  async function whenTheServerRefusesTheSave(refusal: { code: string }): Promise<void> {
    await whenISubmitTheForm();
    lastRequest = http.expectOne(`${API}/works/w-1`);
    lastRequest.flush({ success: false, data: null, error: 'Only a leader can edit it', code: refusal.code }, { status: 403, statusText: 'Forbidden' });
    await settle(harness);
  }

  function thenTheRequestWas(method: string, url: string): void {
    expect(lastRequest.request.method).toBe(method);
    expect(lastRequest.request.url).toBe(url);
  }

  function thenTheSavedFactsAre(facts: object): void {
    expect(lastRequest.request.body.facts).toEqual(facts);
  }

  function thenTheRequestBodyHas(part: object): void {
    expect(lastRequest.request.body).toMatchObject(part);
  }

  function thenTheRequestNeverSaysWhoIAm(): void {
    for (const identity of ['userId', 'editorId', 'authorId', 'publisherId']) {
      expect(lastRequest.request.body).not.toHaveProperty(identity);
    }
  }

  function thenTheFieldIs(label: string, value: string): void {
    expect(field(label).value).toBe(value);
  }

  function thenTheFieldIsInvalidWith(label: string, message: string): void {
    const control = field(label);
    expect(control.getAttribute('aria-invalid')).toBe('true');
    const described = control.getAttribute('aria-describedby')!.split(' ').map((id) => page().querySelector(`#${id}`)!.textContent!.trim());
    expect(described).toContain(message);
  }

  function thenISeeTheAlert(text: string): void {
    expect(page().querySelector('[role="alert"]')!.textContent).toContain(text);
  }

  function thenThereIsALinkTo(href: string): void {
    expect(page().querySelector(`a[href="${href}"]`)).not.toBeNull();
  }

  function thenIAmOn(url: string): void {
    expect(TestBed.inject(Router).url).toBe(url);
  }

  function page(): HTMLElement {
    return harness.routeNativeElement as HTMLElement;
  }

  function form(): HTMLFormElement {
    return page().querySelector('form.series-form') as HTMLFormElement;
  }

  /** The control a visible label names (the required marker and spaces aside). */
  function field(label: string): HTMLInputElement {
    const found = Array.from(page().querySelectorAll('label')).find((l) => l.textContent!.replace('*', '').trim() === label);
    return page().querySelector(`#${found!.getAttribute('for')}`) as HTMLInputElement;
  }

  function link(name: string): HTMLAnchorElement {
    return Array.from(page().querySelectorAll('a')).find((a) => a.textContent!.replace(/\s+/g, ' ').trim() === name) as HTMLAnchorElement;
  }
});
