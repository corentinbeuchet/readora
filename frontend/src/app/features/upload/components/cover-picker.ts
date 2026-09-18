import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/**
 * Cover image picker (drop zone or file dialog) with its preview. Presentational: the parent owns
 * the file and its object URL (and revokes it); this component only reports picks and removals.
 */
@Component({
  selector: 'app-cover-picker',
  templateUrl: './cover-picker.html',
  styleUrl: './cover-picker.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CoverPicker {
  readonly previewUrl = input<string>('');
  readonly fileSelected = output<File>();
  readonly removed = output<void>();

  protected onInputChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      this.fileSelected.emit(file);
    }
    input.value = '';
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    const file = event.dataTransfer?.files?.[0];
    if (file) {
      this.fileSelected.emit(file);
    }
  }
}
