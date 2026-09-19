import { Component, inject } from '@angular/core';
import { AutoScrollSpeed, FitMode, ReaderBackground, ReaderPreferencesStore } from '@app/features/reader/reader-page/reader-preferences-store';
import { ReaderState } from '@app/features/reader/reader-page/reader-state';

/** Reader settings kept for next chapters: page size, background, auto-scroll speed, double page, data saver. */
@Component({
  selector: 'app-reader-settings-panel',
  templateUrl: './reader-settings-panel.html',
  styleUrl: './reader-settings-panel.scss'
})
export class ReaderSettingsPanel {
  protected readonly prefs = inject(ReaderPreferencesStore);
  protected readonly state = inject(ReaderState);

  protected setFit(value: string): void {
    this.prefs.setFit(value as FitMode);
  }

  protected setBackground(value: string): void {
    this.prefs.setBackground(value as ReaderBackground);
  }

  protected setAutoScrollSpeed(value: string): void {
    this.prefs.setAutoScrollSpeed(value as AutoScrollSpeed);
  }
}
