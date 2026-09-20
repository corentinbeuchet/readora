import { maxLength, schema, validate } from '@angular/forms/signals';
import { MAX_ALTERNATIVE_TITLES, MAX_RELEASE_YEAR, MIN_RELEASE_YEAR, WorkFactsDraft, otherTitlesOf, releaseYearOf } from '@app/core/models/catalog';

const MAX_TITLE_LENGTH = 255;

/**
 * The limits of the series facts (US-04), the same as the backend's `WorkFacts`. Apply it to the facts of a larger
 * form: `apply(path.facts, WORK_FACTS_SCHEMA)`.
 */
export const WORK_FACTS_SCHEMA = schema<WorkFactsDraft>((path) => {
  maxLength(path.artist, 120);
  validate(path.releaseYear, ({ value }) =>
    value().trim() !== '' && releaseYearOf(value()) === null
      ? {
          kind: 'releaseYear',
          message: $localize`:@@form.workFacts.year.invalid:Enter a year between ${MIN_RELEASE_YEAR}:min: and ${MAX_RELEASE_YEAR}:max:, or leave it empty`
        }
      : undefined
  );
  validate(path.alternativeTitles, ({ value }) => {
    const titles = otherTitlesOf(value());
    if (titles.length > MAX_ALTERNATIVE_TITLES) {
      return { kind: 'tooManyTitles', message: $localize`:@@form.workFacts.titles.tooMany:A series has at most ${MAX_ALTERNATIVE_TITLES}:max: other titles` };
    }
    return titles.some((title) => title.length > MAX_TITLE_LENGTH)
      ? { kind: 'titleTooLong', message: $localize`:@@form.workFacts.titles.tooLong:A title has at most ${MAX_TITLE_LENGTH}:max: characters` }
      : undefined;
  });
});
