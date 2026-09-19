import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { WorkSummary } from '@app/core/models/catalog';
import { ReadingList } from '@app/core/models/reading-lists';
import { ListCard } from '@app/shared/ui/list-card/list-card';
import { ANY_URL } from '../../../test-utils';

function series(id: string): WorkSummary {
  return { id, title: `Series ${id}`, type: 'MANGA', status: 'ONGOING', author: null, demographic: null, coverImageUrl: `https://cdn.readora.test/${id}.webp`, genres: [] };
}

function listOf(count: number, overrides: Partial<ReadingList> = {}): ReadingList {
  return {
    id: 'l-1',
    title: 'Best of isekai',
    description: '',
    published: true,
    ownerUsername: 'camille',
    ownerId: 'u-1',
    upvotes: 12,
    items: Array.from({ length: count }, (_, index) => ({ work: series(`w-${index + 1}`), note: null })),
    updatedAt: '2026-09-01T00:00:00Z',
    ...overrides
  };
}

describe('ListCard', () => {
  let fixture: ComponentFixture<ListCard>;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter(ANY_URL)] });
  });

  it('is one link to the list, named by its title', () => {
    givenTheCardOf(listOf(5));

    thenTheOnlyLinkIs({ href: '/lists/l-1', name: 'Best of isekai' });
  });

  it('previews the list with the covers of its first three series, as decoration', () => {
    givenTheCardOf(listOf(5));

    thenTheCoverStackShows(3);
    thenTheCoverStackIsHiddenFromAssistiveTechnology();
  });

  it('says who made it, how many series it holds and its upvotes', () => {
    givenTheCardOf(listOf(1, { upvotes: 7 }));

    thenTheCardSays('by camille');
    thenTheCardSays('1 series');
    thenTheCardSays('Upvotes: 7');
  });

  it('tells the owner whether a list is public or private', () => {
    givenTheCardOf(listOf(2, { published: false }), { showVisibility: true });

    thenTheCardSays('Private');
  });

  function givenTheCardOf(list: ReadingList, options: { showVisibility?: boolean } = {}): void {
    fixture = TestBed.createComponent(ListCard);
    fixture.componentRef.setInput('list', list);
    fixture.componentRef.setInput('showVisibility', options.showVisibility ?? false);
    fixture.detectChanges();
  }

  function thenTheOnlyLinkIs(expected: { href: string; name: string }): void {
    const links: HTMLAnchorElement[] = Array.from(fixture.nativeElement.querySelectorAll('a'));
    expect(links.map((a) => ({ href: a.getAttribute('href'), name: a.textContent?.trim() }))).toEqual([expected]);
  }

  function thenTheCoverStackShows(count: number): void {
    expect(fixture.nativeElement.querySelectorAll('.stack img')).toHaveLength(count);
  }

  function thenTheCoverStackIsHiddenFromAssistiveTechnology(): void {
    expect(fixture.nativeElement.querySelector('.stack').getAttribute('aria-hidden')).toBe('true');
  }

  function thenTheCardSays(text: string): void {
    expect(fixture.nativeElement.textContent.replace(/\s+/g, ' ')).toContain(text);
  }
});
