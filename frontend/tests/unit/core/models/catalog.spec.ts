import { NO_FACTS_DRAFT, WorkFacts, WorkFactsDraft, WorkFactsPayload, factsDraftOf, factsPayloadOf, otherTitlesOf, releaseYearOf } from '@app/core/models/catalog';

describe('series facts (US-04)', () => {
  let titles: string[];
  let year: number | null;
  let payload: WorkFactsPayload;
  let draft: WorkFactsDraft;

  it('other titles are one per line, trimmed, without blanks or repeats whatever the case', () => {
    whenTheOtherTitlesTypedAre('  Na Honjaman Level Up \n\n나 혼자만 레벨업\nna honjaman level up\n   ');

    thenTheOtherTitlesAre(['Na Honjaman Level Up', '나 혼자만 레벨업']);
  });

  it.each([
    { typed: '2018', year: 2018 },
    { typed: ' 1989 ', year: 1989 },
    { typed: '1900', year: 1900 },
    { typed: '2100', year: 2100 },
    { typed: '', year: null },
    { typed: '1899', year: null },
    { typed: '2101', year: null },
    { typed: '18', year: null },
    { typed: 'MMXVIII', year: null }
  ])('the year typed as "$typed" is $year', ({ typed, year: expected }) => {
    whenTheYearTypedIs(typed);

    thenTheYearIs(expected);
  });

  it('a request only carries the facts that were filled in', () => {
    whenTheDraftIsSent({ ...NO_FACTS_DRAFT, artist: ' DUBU ', releaseYear: '2018' });

    thenThePayloadIs({ alternativeTitles: [], artist: 'DUBU', releaseYear: 2018 });
  });

  it('a request carries every fact of a complete draft', () => {
    whenTheDraftIsSent({ alternativeTitles: 'Only I Level Up', artist: 'DUBU', releaseYear: '2018', originalLanguage: 'KOREAN', contentRating: 'TEEN' });

    thenThePayloadIs({ alternativeTitles: ['Only I Level Up'], artist: 'DUBU', releaseYear: 2018, originalLanguage: 'KOREAN', contentRating: 'TEEN' });
  });

  it('the facts of a loaded series become a draft: one title per line, empty texts for what is unknown', () => {
    whenTheFactsAreEdited({ alternativeTitles: ['Na Honjaman Level Up', 'Only I Level Up'], artist: null, releaseYear: 2018, originalLanguage: null, contentRating: 'TEEN' });

    thenTheDraftIs({ alternativeTitles: 'Na Honjaman Level Up\nOnly I Level Up', artist: '', releaseYear: '2018', originalLanguage: '', contentRating: 'TEEN' });
  });

  function whenTheOtherTitlesTypedAre(text: string): void {
    titles = otherTitlesOf(text);
  }

  function whenTheYearTypedIs(text: string): void {
    year = releaseYearOf(text);
  }

  function whenTheDraftIsSent(sent: WorkFactsDraft): void {
    payload = factsPayloadOf(sent);
  }

  function whenTheFactsAreEdited(facts: WorkFacts): void {
    draft = factsDraftOf(facts);
  }

  function thenTheOtherTitlesAre(expected: string[]): void {
    expect(titles).toEqual(expected);
  }

  function thenTheYearIs(expected: number | null): void {
    expect(year).toBe(expected);
  }

  function thenThePayloadIs(expected: WorkFactsPayload): void {
    expect(payload).toEqual(expected);
  }

  function thenTheDraftIs(expected: WorkFactsDraft): void {
    expect(draft).toEqual(expected);
  }
});
