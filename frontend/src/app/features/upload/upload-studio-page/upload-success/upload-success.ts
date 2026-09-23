import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PublishFlow } from '@app/features/upload/upload-studio-page/publish-flow';
import { ExistingSeries, UploadWizard } from '@app/features/upload/upload-studio-page/upload-wizard';

/** After publishing: links to what was created, or start over with another chapter or series. */
@Component({
  selector: 'app-upload-success',
  imports: [RouterLink],
  templateUrl: './upload-success.html',
  styleUrl: './upload-success.scss'
})
export class UploadSuccess {
  protected readonly wizard = inject(UploadWizard);
  protected readonly flow = inject(PublishFlow);

  /** The existing series the chapter went into; `null` when the series was created by this publish. */
  readonly existing = input<ExistingSeries | null>(null);
  /** The series of the published chapter, created now or already in the catalog. */
  protected readonly series = computed(() => this.existing()?.work ?? this.flow.createdWork());
}
