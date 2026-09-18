import { Service, signal } from '@angular/core';

/** App-wide layout state. `immersive` hides the site header and footer (reader zen mode, US-06). */
@Service()
export class LayoutStore {
  private readonly _immersive = signal(false);
  readonly immersive = this._immersive.asReadonly();

  setImmersive(immersive: boolean): void {
    this._immersive.set(immersive);
  }
}
