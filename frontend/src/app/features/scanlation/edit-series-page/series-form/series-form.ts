import { Component, inject, input, linkedSignal, output } from '@angular/core';
import { FormField, apply, form, maxLength, required, submit, validate } from '@angular/forms/signals';
import { firstValueFrom } from 'rxjs';
import { CatalogApi } from '@app/core/api/catalog-api';
import {
  DEMOGRAPHIC_LABELS,
  Demographic,
  WORK_STATUS_LABELS,
  WORK_TYPE_LABELS,
  Work,
  WorkFactsDraft,
  WorkStatus,
  WorkType,
  factsDraftOf,
  factsPayloadOf
} from '@app/core/models/catalog';
import { asyncAction } from '@app/core/utils/async-action';
import { AriaInvalidDirective } from '@app/shared/forms/aria-invalid.directive';
import { FieldErrors } from '@app/shared/forms/field-errors';
import { WorkFactsFields } from '@app/shared/forms/work-facts-fields/work-facts-fields';
import { WORK_FACTS_SCHEMA } from '@app/shared/forms/work-facts-fields/work-facts-schema';

interface SeriesDraft {
  title: string;
  type: WorkType;
  status: WorkStatus;
  author: string;
  demographic: Demographic | '';
  /** Separated by commas. */
  genres: string;
  synopsis: string;
  facts: WorkFactsDraft;
}

const MAX_GENRES = 20;
const TITLE_REQUIRED = $localize`:@@scanlation.editSeries.title.required:Give the series a title`;

function genresOf(text: string): string[] {
  return [...new Set(text.split(',').map((genre) => genre.trim()).filter((genre) => genre !== ''))];
}

/** The description of a series as its team leaders edit it (US-04); the cover stays as it is. */
@Component({
  selector: 'app-series-form',
  imports: [FormField, FieldErrors, AriaInvalidDirective, WorkFactsFields],
  templateUrl: './series-form.html',
  styleUrl: './series-form.scss'
})
export class SeriesForm {
  private readonly catalogApi = inject(CatalogApi);

  readonly work = input.required<Work>();
  readonly saved = output<Work>();

  /** Starts as the loaded series and is then the editor's: a `linkedSignal`, not an effect copying the input. */
  private readonly draft = linkedSignal<SeriesDraft>(() => {
    const work = this.work();
    return {
      title: work.title,
      type: work.type,
      status: work.status,
      author: work.author ?? '',
      demographic: work.demographic ?? '',
      genres: work.genres.join(', '),
      synopsis: work.synopsis,
      facts: factsDraftOf(work.facts)
    };
  });
  protected readonly seriesForm = form(this.draft, (path) => {
    required(path.title, { message: TITLE_REQUIRED });
    validate(path.title, ({ value }) => (value() && !value().trim() ? { kind: 'required', message: TITLE_REQUIRED } : undefined));
    maxLength(path.title, 255);
    maxLength(path.author, 120);
    maxLength(path.synopsis, 5000);
    validate(path.genres, ({ value }) => {
      const genres = genresOf(value());
      if (genres.length > MAX_GENRES) {
        return { kind: 'tooManyGenres', message: $localize`:@@scanlation.editSeries.genres.tooMany:A series has at most ${MAX_GENRES}:max: genres` };
      }
      return genres.some((genre) => genre.length > 50)
        ? { kind: 'genreTooLong', message: $localize`:@@scanlation.editSeries.genres.tooLong:A genre has at most 50 characters` }
        : undefined;
    });
    apply(path.facts, WORK_FACTS_SCHEMA);
  });
  protected readonly saving = asyncAction();

  protected readonly types = (Object.keys(WORK_TYPE_LABELS) as WorkType[]).map((code) => ({ code, label: WORK_TYPE_LABELS[code] }));
  protected readonly statuses = (Object.keys(WORK_STATUS_LABELS) as WorkStatus[]).map((code) => ({ code, label: WORK_STATUS_LABELS[code] }));
  protected readonly audiences = (Object.keys(DEMOGRAPHIC_LABELS) as Demographic[]).map((code) => ({ code, label: DEMOGRAPHIC_LABELS[code] }));

  /** `PUT` replaces the whole description, so everything is sent back, the untouched cover included. */
  protected async save(event: Event): Promise<void> {
    event.preventDefault();
    this.saving.clearError();
    await submit(this.seriesForm, async (f) => {
      const draft = f().value();
      await this.saving.run(
        async () => {
          const work = await firstValueFrom(
            this.catalogApi.updateWork(this.work().id, {
              title: draft.title.trim(),
              synopsis: draft.synopsis.trim(),
              type: draft.type,
              status: draft.status,
              author: draft.author.trim() || undefined,
              demographic: draft.demographic || undefined,
              coverImageUrl: this.work().coverImageUrl ?? undefined,
              genres: genresOf(draft.genres),
              facts: factsPayloadOf(draft.facts)
            })
          );
          this.saved.emit(work);
        },
        { fallback: $localize`:@@scanlation.editSeries.saveError:The series could not be saved.` }
      );
    });
  }
}
