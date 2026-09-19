import { Component } from '@angular/core';
import { Shell } from '@app/features/layout/shell/shell';

@Component({
  selector: 'app-root',
  imports: [Shell],
  templateUrl: './app.html'
})
export class App {}
