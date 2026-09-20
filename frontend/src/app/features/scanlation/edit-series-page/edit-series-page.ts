import { Component, inject, input } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CatalogApi } from '@app/core/api/catalog-api';
import { Work } from '@app/core/models/catalog';
import { SeoService } from '@app/core/seo/seo.service';
import { LoadError } from '@app/shared/ui/load-error';
import { SeriesForm } from './series-form/series-form';

/**
 * Where the leaders of a team correct the page of a series they translate (US-04), reached from "My teams". The
 * server decides who may save: the page only needs `WORK_CREATE` to open.
 */
@Component({
  selector: 'app-edit-series-page',
  imports: [LoadError, RouterLink, SeriesForm],
  templateUrl: './edit-series-page.html',
  styleUrl: './edit-series-page.scss'
})
export class EditSeriesPage {
  private readonly router = inject(Router);

  /** Bound from `scanlation/series/:workId`. */
  readonly workId = input.required<string>();

  protected readonly work = inject(CatalogApi).workResource(this.workId);

  constructor() {
    inject(SeoService).private_($localize`:@@scanlation.editSeries.seoTitle:Edit series`);
  }

  protected openSeries(work: Work): Promise<boolean> {
    return this.router.navigate(['/works', work.id]);
  }
}
