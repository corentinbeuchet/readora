import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PublishFlow } from '@app/features/upload/upload-studio-page/publish-flow';
import { UploadWizard } from '@app/features/upload/upload-studio-page/upload-wizard';

/** After publishing: links to what was created, or start over with another series. */
@Component({
  selector: 'app-upload-success',
  imports: [RouterLink],
  templateUrl: './upload-success.html',
  styleUrl: './upload-success.scss'
})
export class UploadSuccess {
  protected readonly wizard = inject(UploadWizard);
  protected readonly flow = inject(PublishFlow);
}
