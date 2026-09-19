import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { ListPage } from '@app/features/lists/list-page';
import { AuthStore } from '@app/core/auth/auth-store';
import { ReadingList } from '@app/core/models/readora.models';
import { mockUser, signIn } from '../../core/auth/auth-fixtures';
import { API, ok, provideHttpTesting, settle } from '../../test-utils';

const LIST: ReadingList = {
  id: 'l-1',
  title: 'Peak Webtoons',
  description: 'The finest action manhwas',
  published: false,
  ownerUsername: 'kenji',
  ownerId: 'kenji-id',
  upvotes: 0,
  items: [
    { work: { id: 'w-1', title: 'Solo Leveling', type: 'MANHWA', status: 'COMPLETED', coverImageUrl: '', genres: [] }, note: 'Masterpiece dungeon art' },
    { work: { id: 'w-2', title: 'Omniscient Reader', type: 'MANHWA', status: 'ONGOING', coverImageUrl: '', genres: [] }, note: null }
  ],
  updatedAt: '2026-09-10T10:00:00Z'
};

describe('ListPage (US-05)', () => {
  let fixture: ComponentFixture<ListPage>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ListPage],
      providers: [provideRouter([]), ...provideHttpTesting()]
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  async function open(userId: string, list: ReadingList = LIST): Promise<void> {
    await signIn(TestBed.inject(AuthStore), http, mockUser({ id: userId, permissions: ['LIBRARY_USE'] }));
    fixture = TestBed.createComponent(ListPage);
    fixture.componentRef.setInput('listId', 'l-1');
    await settle(fixture);
    http.expectOne(`${API}/lists/l-1`).flush(ok(list));
    await settle(fixture);
  }

  it('shows the series with the owner\'s notes', async () => {
    await open('someone-else', { ...LIST, published: true });

    const items = fixture.nativeElement.querySelectorAll('.list-item');
    expect(items).toHaveLength(2);
    expect(items[0].textContent).toContain('Masterpiece dungeon art');
    expect(fixture.nativeElement.querySelector('.badge')).toBeNull();
  });

  it('lets the owner edit notes, remove a series and publish the list', async () => {
    await open('kenji-id');
    Array.from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>).find((b) => b.textContent?.includes('Edit list'))!.click();
    await settle(fixture);

    const note: HTMLInputElement = fixture.nativeElement.querySelector('#note-w-2');
    note.value = 'Unbeatable worldbuilding';
    note.dispatchEvent(new Event('input'));
    const publish: HTMLInputElement = fixture.nativeElement.querySelector('input[type="checkbox"]');
    publish.click();
    fixture.nativeElement.querySelectorAll('.list-item .btn-danger-outline')[0].click();
    await settle(fixture);
    fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit', { cancelable: true }));

    const req = http.expectOne(`${API}/lists/l-1`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({
      title: 'Peak Webtoons',
      description: 'The finest action manhwas',
      published: true,
      items: [{ workId: 'w-2', note: 'Unbeatable worldbuilding' }]
    });
    req.flush(ok({ ...LIST, published: true, items: [LIST.items[1]] }));
    await settle(fixture);
    expect(fixture.nativeElement.textContent).toContain('Saved. Your list is public.');
  });

  it('drops an unsaved edit when another list is opened, and never shows the previous list', async () => {
    await open('kenji-id');
    Array.from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>).find((b) => b.textContent?.includes('Edit list'))!.click();
    await settle(fixture);
    expect(fixture.nativeElement.querySelector('form')).not.toBeNull();

    fixture.componentRef.setInput('listId', 'l-2');
    await settle(fixture);
    expect(fixture.nativeElement.textContent).not.toContain('Peak Webtoons');
    http.expectOne(`${API}/lists/l-2`).flush(ok({ ...LIST, id: 'l-2', title: 'Comfort reads', ownerId: 'aoi-id', ownerUsername: 'aoi', published: true }));
    await settle(fixture);

    expect(fixture.nativeElement.querySelector('form')).toBeNull();
    expect(fixture.nativeElement.querySelector('h1').textContent).toContain('Comfort reads');
    const buttons = Array.from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>).map((b) => b.textContent);
    expect(buttons.some((t) => t?.includes('Edit list'))).toBe(false);
    expect(buttons.some((t) => t?.includes('Upvote'))).toBe(true);
  });

  it('lets other readers upvote a public list, but not the owner', async () => {
    await open('aoi-id', { ...LIST, published: true, upvotes: 2 });
    const upvote = (): HTMLButtonElement | undefined =>
      Array.from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>).find((b) => b.textContent?.includes('Upvote'));
    upvote()!.click();
    http.expectOne(`${API}/lists/l-1/upvote`).flush(ok({ upvotes: 3 }));
    await settle(fixture);
    expect(upvote()!.textContent).toContain('(3)');
  });
});
