import { Component, DOCUMENT, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ProfileApi } from '@app/core/api/profile-api';
import { asyncAction } from '@app/core/utils/async-action';

/** Downloading everything Readora keeps about me, as one JSON file (US-15). */
@Component({
  selector: 'app-download-data',
  templateUrl: './download-data.html'
})
export class DownloadData {
  private readonly profileApi = inject(ProfileApi);
  private readonly document = inject(DOCUMENT);

  protected readonly downloading = asyncAction($localize`:@@profile.data.error:Your data could not be downloaded. Please try again.`);
  protected readonly done = signal('');

  protected async download(): Promise<void> {
    this.done.set('');
    const saved = await this.downloading.run(async () => {
      this.saveFile(await firstValueFrom(this.profileApi.exportAccount()), 'readora-account.json');
      return true;
    });
    if (saved) {
      this.done.set($localize`:@@profile.data.done:Your data is downloaded (readora-account.json).`);
    }
  }

  /** Browser side effect, overridable in tests. */
  protected saveFile(file: Blob, name: string): void {
    const win = this.document.defaultView;
    if (!win?.URL?.createObjectURL) return;
    const url = win.URL.createObjectURL(file);
    const link = this.document.createElement('a');
    link.href = url;
    link.download = name;
    link.click();
    win.URL.revokeObjectURL(url);
  }
}
