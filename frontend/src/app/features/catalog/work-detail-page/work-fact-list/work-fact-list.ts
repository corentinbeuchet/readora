import { Component, computed, input } from '@angular/core';
import { CONTENT_RATING_LABELS, DEMOGRAPHIC_LABELS, ORIGINAL_LANGUAGE_LABELS, Work } from '@app/core/models/catalog';

interface Fact {
  key: string;
  label: string;
  values: string[];
}

/** What is known about a series beside its synopsis (US-04): a fact nobody filled in is not listed. */
@Component({
  selector: 'app-work-fact-list',
  templateUrl: './work-fact-list.html',
  styleUrl: './work-fact-list.scss'
})
export class WorkFactList {
  readonly work = input.required<Work>();

  protected readonly facts = computed<Fact[]>(() => {
    const work = this.work();
    const facts = work.facts;
    const known = (value: string | number | null): string[] => (value === null || value === '' ? [] : [String(value)]);
    return [
      { key: 'titles', label: $localize`:@@catalog.work.facts.otherTitles:Other titles`, values: facts.alternativeTitles },
      { key: 'author', label: $localize`:@@catalog.work.facts.author:Author`, values: known(work.author) },
      { key: 'artist', label: $localize`:@@catalog.work.facts.artist:Artist`, values: known(facts.artist) },
      { key: 'year', label: $localize`:@@catalog.work.facts.year:First published`, values: known(facts.releaseYear) },
      {
        key: 'language',
        label: $localize`:@@catalog.work.facts.language:Original language`,
        values: known(facts.originalLanguage && ORIGINAL_LANGUAGE_LABELS[facts.originalLanguage])
      },
      { key: 'audience', label: $localize`:@@catalog.work.facts.audience:Audience`, values: known(work.demographic && DEMOGRAPHIC_LABELS[work.demographic]) },
      {
        key: 'rating',
        label: $localize`:@@catalog.work.facts.rating:Content rating`,
        values: known(facts.contentRating && CONTENT_RATING_LABELS[facts.contentRating])
      }
    ].filter((fact) => fact.values.length > 0);
  });
}
