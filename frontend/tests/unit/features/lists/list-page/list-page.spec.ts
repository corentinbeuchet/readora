import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController, TestRequest } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { ListPage } from '@app/features/lists/list-page/list-page';
import { AuthStore } from '@app/core/auth/auth-store';
import { ReadingList } from '@app/core/models/reading-lists';
import { mockUser, signIn } from '../../../core/auth/auth-fixtures';
import { API, ok, provideHttpTesting, settle } from '../../../test-utils';

const LIST: ReadingList = {
  id: 'l-1',
  title: 'Peak Webtoons',
  description: 'The finest action manhwas',
  published: false,
  ownerUsername: 'kenji',
  ownerId: 'kenji-id',
  upvotes: 0,
  items: [
    { work: { id: 'w-1', title: 'Solo Leveling', type: 'MANHWA', status: 'COMPLETED', author: null, demographic: null, coverImageUrl: '', genres: [] }, note: 'Masterpiece dungeon art' },
    { work: { id: 'w-2', title: 'Omniscient Reader', type: 'MANHWA', status: 'ONGOING', author: null, demographic: null, coverImageUrl: '', genres: [] }, note: null }
  ],
  updatedAt: '2026-09-10T10:00:00Z'
};

describe('ListPage (US-05)', () => {
  let fixture: ComponentFixture<ListPage>;
  let http: HttpTestingController;
  let lastRequest: TestRequest;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ListPage],
      providers: [provideRouter([]), ...provideHttpTesting()]
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('shows the series with the owner\'s notes', async () => {
    await givenIAmSignedInAs('someone-else');

    await whenIOpen({ ...LIST, published: true });

    thenTheListHasSeries(2);
    thenSeriesShows(1, 'Masterpiece dungeon art');
    thenTheListIsNotMarkedPrivate();
  });

  it('lets the owner edit notes, remove a series and publish the list', async () => {
    await givenIAmSignedInAs('kenji-id');
    await givenIAmOn(LIST);

    await whenIStartEditingTheList();
    whenIWriteTheNote('w-2', 'Unbeatable worldbuilding');
    whenITickPublish();
    await whenIRemoveSeries(1);
    await whenISave({ saved: { ...LIST, published: true, items: [LIST.items[1]] } });

    thenTheSaveRequestWas('PUT', {
      title: 'Peak Webtoons',
      description: 'The finest action manhwas',
      published: true,
      items: [{ workId: 'w-2', note: 'Unbeatable worldbuilding' }]
    });
    thenICanSee('Saved. Your list is public.');
  });

  it('drops an unsaved edit when another list is opened, and never shows the previous list', async () => {
    await givenIAmSignedInAs('kenji-id');
    await givenIAmOn(LIST);
    await givenIAmEditingTheList();
    thenTheEditFormIsOpen();

    await whenINavigateToTheList('l-2');

    thenIDoNotSee('Peak Webtoons');

    await whenTheListArrives({ ...LIST, id: 'l-2', title: 'Comfort reads', ownerId: 'aoi-id', ownerUsername: 'aoi', published: true });

    thenTheEditFormIsClosed();
    thenTheTitleIs('Comfort reads');
    thenICannotEditTheList();
    thenICanUpvoteTheList();
  });

  it('lets other readers upvote a public list, but not the owner', async () => {
    await givenIAmSignedInAs('aoi-id');
    await givenIAmOn({ ...LIST, published: true, upvotes: 2 });

    await whenIUpvoteTheList({ upvotesNow: 3 });

    thenTheUpvoteButtonShows('(3)');
  });

  async function givenIAmSignedInAs(userId: string): Promise<void> {
    await signIn(TestBed.inject(AuthStore), http, mockUser({ id: userId, permissions: ['LIBRARY_USE'] }));
  }

  async function givenIAmOn(list: ReadingList): Promise<void> {
    await whenIOpen(list);
  }

  async function givenIAmEditingTheList(): Promise<void> {
    await whenIStartEditingTheList();
  }

  async function whenIOpen(list: ReadingList): Promise<void> {
    fixture = TestBed.createComponent(ListPage);
    fixture.componentRef.setInput('listId', list.id);
    await settle(fixture);
    http.expectOne(`${API}/lists/${list.id}`).flush(ok(list));
    await settle(fixture);
  }

  async function whenIStartEditingTheList(): Promise<void> {
    button('Edit list')!.click();
    await settle(fixture);
  }

  function whenIWriteTheNote(workId: string, text: string): void {
    const note: HTMLInputElement = fixture.nativeElement.querySelector(`#note-${workId}`);
    note.value = text;
    note.dispatchEvent(new Event('input'));
  }

  function whenITickPublish(): void {
    fixture.nativeElement.querySelector('input[type="checkbox"]').click();
  }

  async function whenIRemoveSeries(position: number): Promise<void> {
    fixture.nativeElement.querySelectorAll('.list-item .btn-danger-outline')[position - 1].click();
    await settle(fixture);
  }

  async function whenISave(answer: { saved: ReadingList }): Promise<void> {
    fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit', { cancelable: true }));
    lastRequest = http.expectOne(`${API}/lists/${answer.saved.id}`);
    lastRequest.flush(ok(answer.saved));
    await settle(fixture);
  }

  /** The new list's request stays pending until `whenTheListArrives` answers it. */
  async function whenINavigateToTheList(listId: string): Promise<void> {
    fixture.componentRef.setInput('listId', listId);
    await settle(fixture);
    lastRequest = http.expectOne(`${API}/lists/${listId}`);
  }

  async function whenTheListArrives(list: ReadingList): Promise<void> {
    lastRequest.flush(ok(list));
    await settle(fixture);
  }

  async function whenIUpvoteTheList(answer: { upvotesNow: number }): Promise<void> {
    button('Upvote')!.click();
    http.expectOne(`${API}/lists/l-1/upvote`).flush(ok({ upvotes: answer.upvotesNow }));
    await settle(fixture);
  }

  function thenTheListHasSeries(count: number): void {
    expect(listItems()).toHaveLength(count);
  }

  function thenSeriesShows(position: number, text: string): void {
    expect(listItems()[position - 1].textContent).toContain(text);
  }

  function thenTheListIsNotMarkedPrivate(): void {
    expect(fixture.nativeElement.querySelector('header .badge')).toBeNull();
  }

  function thenTheSaveRequestWas(method: string, body: unknown): void {
    expect(lastRequest.request.method).toBe(method);
    expect(lastRequest.request.body).toEqual(body);
  }

  function thenICanSee(text: string): void {
    expect(fixture.nativeElement.textContent).toContain(text);
  }

  function thenIDoNotSee(text: string): void {
    expect(fixture.nativeElement.textContent).not.toContain(text);
  }

  function thenTheEditFormIsOpen(): void {
    expect(fixture.nativeElement.querySelector('form')).not.toBeNull();
  }

  function thenTheEditFormIsClosed(): void {
    expect(fixture.nativeElement.querySelector('form')).toBeNull();
  }

  function thenTheTitleIs(title: string): void {
    expect(fixture.nativeElement.querySelector('h1').textContent).toContain(title);
  }

  function thenICannotEditTheList(): void {
    expect(button('Edit list')).toBeUndefined();
  }

  function thenICanUpvoteTheList(): void {
    expect(button('Upvote')).toBeDefined();
  }

  function thenTheUpvoteButtonShows(text: string): void {
    expect(button('Upvote')!.textContent).toContain(text);
  }

  function listItems(): HTMLElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('.list-items > li'));
  }

  function button(label: string): HTMLButtonElement | undefined {
    return Array.from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>).find((b) => b.textContent?.includes(label));
  }
});
