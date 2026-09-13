import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Shell } from './features/layout/shell';

@Component({
  selector: 'app-root',
  imports: [Shell],
  templateUrl: './app.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class App {}
