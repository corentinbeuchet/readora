import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController, TestRequest } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AddToList } from '@app/features/catalog/work-detail-page/add-to-list/add-to-list';
import { AuthStore } from '@app/core/auth/auth-store';
import { mockUser, signIn } from '../../../../core/auth/auth-fixtures';
import { API, ok, provideHttpTesting, settle } from '../../../../test-utils';

interface MyList {
  id: string;
  title: string;
}

describe('AddToList (US-05)', () => {
  let fixture: ComponentFixture<AddToList>;
  let http: HttpTestingController;
  let myLists: MyList[];
  let lastRequest: TestRequest;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddToList],
      providers: [provideRouter([]), ...provideHttpTesting()]
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('adds the series with a note to the chosen list', async () => {
    await givenMyListsAre([
      { id: 'l-1', title: 'Peak Webtoons' },
      { id: 'l-2', title: 'Comfort reads' }
    ]);

    await whenIAddTheSeriesTo('l-2', { note: 'Cozy' });

    thenTheItemSentWas({ workId: 'w-1', note: 'Cozy' });
    thenICanSee('Added to “Comfort reads”.');
  });

  it('invites to make a list when there is none', async () => {
    await givenMyListsAre([]);

    thenIAmInvitedToMakeAListAt('/lists');
  });

  /** A signed-in reader looking at the add-to-list panel of series `w-1`. */
  async function givenMyListsAre(lists: MyList[]): Promise<void> {
    myLists = lists;
    await signIn(TestBed.inject(AuthStore), http, mockUser({ permissions: ['LIBRARY_USE'] }));
    fixture = TestBed.createComponent(AddToList);
    fixture.componentRef.setInput('workId', 'w-1');
    await settle(fixture);
    http.expectOne(`${API}/lists/mine`).flush(ok(lists.map((l) => ({ ...l, items: [] }))));
    await settle(fixture);
  }

  async function whenIAddTheSeriesTo(listId: string, entry: { note: string }): Promise<void> {
    const select: HTMLSelectElement = fixture.nativeElement.querySelector('select');
    select.value = listId;
    select.dispatchEvent(new Event('change'));
    const note: HTMLInputElement = fixture.nativeElement.querySelector('input');
    note.value = entry.note;
    note.dispatchEvent(new Event('input'));
    fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit', { cancelable: true }));
    lastRequest = http.expectOne(`${API}/lists/${listId}/items`);
    lastRequest.flush(ok({ ...myLists.find((l) => l.id === listId)!, items: [{}] }));
    await settle(fixture);
  }

  function thenTheItemSentWas(body: { workId: string; note: string }): void {
    expect(lastRequest.request.body).toEqual(body);
  }

  function thenICanSee(text: string): void {
    expect(fixture.nativeElement.textContent).toContain(text);
  }

  function thenIAmInvitedToMakeAListAt(href: string): void {
    expect(fixture.nativeElement.querySelector('a').getAttribute('href')).toBe(href);
  }
});
