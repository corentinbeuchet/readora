import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CatalogApi } from '@app/core/api/catalog-api';
import { HasPermissionDirective } from '@app/core/auth/has-permission.directive';
import { SeoService } from '@app/core/seo/seo.service';
import { FALLBACK_COVER_IMAGE, onImageError } from '@app/core/utils/image-utils';

const PAGE_SIZE = 24;

@Component({
  selector: 'app-works-page',
  imports: [RouterLink, HasPermissionDirective],
  templateUrl: './works-page.html',
  styleUrl: './works-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WorksPage {
  private readonly catalogApi = inject(CatalogApi);
  private readonly seo = inject(SeoService);
  protected readonly fallbackCover = FALLBACK_COVER_IMAGE;
  protected readonly handleCoverError = onImageError;

  protected readonly page = signal(0);
  protected readonly pageSize = signal(PAGE_SIZE);
  protected readonly works = this.catalogApi.worksResource(this.page, this.pageSize);

  protected readonly hasPrevious = computed(() => this.page() > 0);
  protected readonly hasNext = computed(() => this.page() + 1 < (this.works.hasValue() ? this.works.value().totalPages : 0));

  constructor() {
    this.seo.update({
      title: 'Catalog — manga, manhwa & comics',
      description: 'Browse every manga, manhwa, manhua and comic published on Readora by scanlation teams.',
      path: '/works'
    });
  }

  protected previous(): void {
    if (this.hasPrevious()) {
      this.page.update((p) => p - 1);
    }
  }

  protected next(): void {
    if (this.hasNext()) {
      this.page.update((p) => p + 1);
    }
  }

  protected reload(): void {
    this.works.reload();
  }
}
