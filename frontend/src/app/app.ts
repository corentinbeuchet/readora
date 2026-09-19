import { Component } from '@angular/core';
import { Shell } from './features/layout/shell';

@Component({
  selector: 'app-root',
  imports: [Shell],
  templateUrl: './app.html'
})
export class App {}
