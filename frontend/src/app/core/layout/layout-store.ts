import { Service, signal } from '@angular/core';

/**
 * App-wide layout state. `immersive` hides the site header and footer (reader zen mode, US-06); `tabBarHidden`
 * hides the phone tab bar on pages that need the whole screen (the reader, US-14).
 */
@Service()
export class LayoutStore {
  private readonly _immersive = signal(false);
  readonly immersive = this._immersive.asReadonly();
  private readonly _tabBarHidden = signal(false);
  readonly tabBarHidden = this._tabBarHidden.asReadonly();

  setImmersive(immersive: boolean): void {
    this._immersive.set(immersive);
  }

  setTabBarHidden(hidden: boolean): void {
    this._tabBarHidden.set(hidden);
  }
}
