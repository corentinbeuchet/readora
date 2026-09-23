import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { InviteMember, READER_SEARCH_DEBOUNCE_MS } from '@app/features/scanlation/my-teams-page/team-panel/invite-member/invite-member';
import { ReaderRef } from '@app/core/models/community';
import { MyTeam } from '@app/core/models/scanlation';
import { API, ok, provideHttpTesting } from '../../../../../test-utils';

const MOON_SCANS: MyTeam = { id: 't-1', name: 'Moon Scans', description: null, myRoles: ['LEADER'], boards: [] };

describe('InviteMember (US-12)', () => {
  let fixture: ComponentFixture<InviteMember>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InviteMember],
      providers: [...provideHttpTesting()]
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    // Time is faked before the component exists: suggestions wait for a pause in typing.
    vi.useFakeTimers();
  });

  afterEach(() => {
    http.verify();
    vi.useRealTimers();
  });

  it('Inviting finds a reader by the start of their name', async () => {
    await givenILeadTheTeam(MOON_SCANS);

    await whenITypeAndPause('bo', { found: [{ username: 'bob', displayName: 'Bob the Translator' }] });

    thenTheSuggestionsAre([{ value: 'bob', label: 'Bob the Translator' }]);
  });

  it('one letter asks for nothing', async () => {
    await givenILeadTheTeam(MOON_SCANS);

    await whenITypeAndPause('b');

    thenNothingWasAsked();
    thenTheSuggestionsAre([]);
  });

  async function givenILeadTheTeam(team: MyTeam): Promise<void> {
    fixture = TestBed.createComponent(InviteMember);
    fixture.componentRef.setInput('team', team);
    await renderUnderFakeTimers();
    http.expectOne(`${API}/teams/${team.id}/invitations`).flush(ok([]));
    await renderUnderFakeTimers();
  }

  /** Types `text`, lets the pause go by, and answers the search if one is made. */
  async function whenITypeAndPause(text: string, answer?: { found: ReaderRef[] }): Promise<void> {
    const input = fixture.nativeElement.querySelector('#member-username-t-1') as HTMLInputElement;
    input.value = text;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(READER_SEARCH_DEBOUNCE_MS);
    if (answer) {
      http.expectOne((request) => request.url === `${API}/users` && request.params.get('q') === text).flush(ok(answer.found));
    }
    await renderUnderFakeTimers();
  }

  function thenTheSuggestionsAre(expected: { value: string; label: string }[]): void {
    const options = Array.from(fixture.nativeElement.querySelectorAll('datalist option') as NodeListOf<HTMLOptionElement>);
    expect(options.map((option) => ({ value: option.value, label: option.textContent!.trim() }))).toEqual(expected);
  }

  function thenNothingWasAsked(): void {
    http.expectNone((request) => request.url === `${API}/users`);
  }

  /** `settle()` from test-utils waits with a real timer; under fake timers the clock is moved instead. */
  async function renderUnderFakeTimers(): Promise<void> {
    await vi.advanceTimersByTimeAsync(0);
    fixture.detectChanges();
  }
});
