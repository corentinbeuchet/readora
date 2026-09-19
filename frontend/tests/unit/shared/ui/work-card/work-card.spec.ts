import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { WorkSummary } from '@app/core/models/catalog';
import { WorkCard } from '@app/shared/ui/work-card/work-card';
import { ANY_URL } from '../../../test-utils';

const SOLO: WorkSummary = {
  id: 'w-1',
  title: 'Solo Leveling',
  type: 'MANHWA',
  status: 'ONGOING',
  author: 'Chugong',
  demographic: null,
  coverImageUrl: 'https://cdn.readora.test/solo.webp',
  genres: ['Action']
};

@Component({
  imports: [WorkCard],
  template: `
    <app-work-card [work]="work()" [variant]="variant()" [rank]="rank()" [newChapters]="newChapters()">
      <p cardMeta>Chapter 12</p>
      <button cardActions type="button">Remove</button>
    </app-work-card>
  `
})
class Host {
  readonly work = signal(SOLO);
  readonly variant = signal<'grid' | 'row'>('grid');
  readonly rank = signal<number | undefined>(undefined);
  readonly newChapters = signal(0);
}

describe('WorkCard', () => {
  let fixture: ComponentFixture<Host>;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter(ANY_URL)] });
  });

  it('is one link to the series, named by its title alone', () => {
    givenTheCardOf(SOLO);

    thenTheOnlyLinkGoesTo('/works/w-1');
    thenTheLinkIsNamed('Solo Leveling');
    thenTheCoverIsDecoration();
  });

  it('shows the type and status by their names, not the API codes', () => {
    givenTheCardOf(SOLO);

    thenTheBadgesAre(['Manhwa', 'Ongoing']);
  });

  it('shows new chapters instead of the status, so there are never more than two badges', () => {
    givenTheCardOf(SOLO, { newChapters: 3 });

    thenTheBadgesAre(['3 new chapters', 'Manhwa']);
  });

  it('draws the position of a ranked series', () => {
    givenTheCardOf(SOLO, { variant: 'row', rank: 2 });

    thenTheRankReads('Rank 2');
  });

  it('keeps the projected line and actions outside the link', () => {
    givenTheCardOf(SOLO, { variant: 'row' });

    thenTheCardShows('Chapter 12');
    thenTheActionIsNotInsideTheLink('Remove');
  });

  function givenTheCardOf(work: WorkSummary, options: { variant?: 'grid' | 'row'; rank?: number; newChapters?: number } = {}): void {
    fixture = TestBed.createComponent(Host);
    fixture.componentInstance.work.set(work);
    fixture.componentInstance.variant.set(options.variant ?? 'grid');
    fixture.componentInstance.rank.set(options.rank);
    fixture.componentInstance.newChapters.set(options.newChapters ?? 0);
    fixture.detectChanges();
  }

  function thenTheOnlyLinkGoesTo(href: string): void {
    expect(links().map((a) => a.getAttribute('href'))).toEqual([href]);
  }

  function thenTheLinkIsNamed(name: string): void {
    expect(links()[0].textContent?.trim()).toBe(name);
  }

  function thenTheCoverIsDecoration(): void {
    expect(card().querySelector('img')!.getAttribute('alt')).toBe('');
  }

  function thenTheBadgesAre(labels: string[]): void {
    expect(Array.from(card().querySelectorAll('.badge')).map(text)).toEqual(labels);
  }

  function thenTheRankReads(label: string): void {
    expect(text(card().querySelector('.rank'))).toBe(label);
  }

  function thenTheCardShows(line: string): void {
    expect(card().textContent).toContain(line);
  }

  function thenTheActionIsNotInsideTheLink(label: string): void {
    const action = Array.from(card().querySelectorAll('button')).find((button) => button.textContent?.trim() === label)!;
    expect(action.closest('a')).toBeNull();
  }

  function card(): HTMLElement {
    return fixture.nativeElement.querySelector('app-work-card');
  }

  function links(): HTMLAnchorElement[] {
    return Array.from(card().querySelectorAll('a'));
  }

  function text(element: Element | null): string {
    return (element?.textContent ?? '').replace(/\s+/g, ' ').trim();
  }
});
