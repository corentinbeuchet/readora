import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Work } from '@app/core/models/catalog';
import { WorkFactList } from '@app/features/catalog/work-detail-page/work-fact-list/work-fact-list';

const NOTHING_KNOWN: Work = {
  id: 'w-1',
  title: 'Solo Leveling',
  synopsis: 'Hunters',
  type: 'MANHWA',
  status: 'COMPLETED',
  author: null,
  demographic: null,
  coverImageUrl: null,
  genres: ['Action'],
  facts: { alternativeTitles: [], artist: null, releaseYear: null, originalLanguage: null, contentRating: null }
};

describe('WorkFactList (US-04)', () => {
  let fixture: ComponentFixture<WorkFactList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [WorkFactList] }).compileComponents();
  });

  it('lists every known fact with its label, the author and the audience included', async () => {
    await givenTheSeries({
      ...NOTHING_KNOWN,
      author: 'Chugong',
      demographic: 'SHOUNEN',
      facts: { alternativeTitles: ['Na Honjaman Level Up', 'Only I Level Up'], artist: 'DUBU', releaseYear: 2018, originalLanguage: 'KOREAN', contentRating: 'TEEN' }
    });

    thenTheFactsAre([
      { fact: 'Other titles', values: ['Na Honjaman Level Up', 'Only I Level Up'] },
      { fact: 'Author', values: ['Chugong'] },
      { fact: 'Artist', values: ['DUBU'] },
      { fact: 'First published', values: ['2018'] },
      { fact: 'Original language', values: ['Korean'] },
      { fact: 'Audience', values: ['Shounen'] },
      { fact: 'Content rating', values: ['Teen (13+)'] }
    ]);
  });

  it('a fact nobody filled in is not listed', async () => {
    await givenTheSeries({ ...NOTHING_KNOWN, facts: { ...NOTHING_KNOWN.facts, releaseYear: 1989 } });

    thenTheFactsAre([{ fact: 'First published', values: ['1989'] }]);
  });

  it('shows no list at all when nothing is known', async () => {
    await givenTheSeries(NOTHING_KNOWN);

    thenThereIsNoList();
  });

  async function givenTheSeries(work: Work): Promise<void> {
    fixture = TestBed.createComponent(WorkFactList);
    fixture.componentRef.setInput('work', work);
    await fixture.whenStable();
  }

  function thenTheFactsAre(expected: { fact: string; values: string[] }[]): void {
    const facts: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('dl .fact'));
    expect(
      facts.map((fact) => ({
        fact: fact.querySelector('dt')!.textContent!.trim(),
        values: Array.from(fact.querySelectorAll('dd')).map((value) => value.textContent!.trim())
      }))
    ).toEqual(expected);
  }

  function thenThereIsNoList(): void {
    expect(fixture.nativeElement.querySelector('dl')).toBeNull();
  }
});
