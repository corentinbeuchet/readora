import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AddToList } from '@app/features/catalog/components/add-to-list';
import { AuthStore } from '@app/core/auth/auth-store';
import { mockUser, signIn } from '../../../core/auth/auth-fixtures';
import { API, ok, provideHttpTesting, settle } from '../../../test-utils';

describe('AddToList (US-05)', () => {
  let fixture: ComponentFixture<AddToList>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddToList],
      providers: [provideRouter([]), ...provideHttpTesting()]
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    await signIn(TestBed.inject(AuthStore), http, mockUser({ permissions: ['LIBRARY_USE'] }));
    fixture = TestBed.createComponent(AddToList);
    fixture.componentRef.setInput('workId', 'w-1');
    await settle(fixture);
  });

  afterEach(() => http.verify());

  it('adds the series with a note to the chosen list', async () => {
    const lists = [
      { id: 'l-1', title: 'Peak Webtoons', items: [] },
      { id: 'l-2', title: 'Comfort reads', items: [] }
    ];
    http.expectOne(`${API}/lists/mine`).flush(ok(lists));
    await settle(fixture);

    const select: HTMLSelectElement = fixture.nativeElement.querySelector('select');
    select.value = 'l-2';
    select.dispatchEvent(new Event('change'));
    const note: HTMLInputElement = fixture.nativeElement.querySelector('input');
    note.value = 'Cozy';
    note.dispatchEvent(new Event('input'));
    fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit', { cancelable: true }));

    const req = http.expectOne(`${API}/lists/l-2/items`);
    expect(req.request.body).toEqual({ workId: 'w-1', note: 'Cozy' });
    req.flush(ok({ ...lists[1], items: [{}] }));
    await settle(fixture);
    expect(fixture.nativeElement.textContent).toContain('Added to “Comfort reads”.');
  });

  it('invites to make a list when there is none', async () => {
    http.expectOne(`${API}/lists/mine`).flush(ok([]));
    await settle(fixture);
    expect(fixture.nativeElement.querySelector('a').getAttribute('href')).toBe('/lists');
  });
});
