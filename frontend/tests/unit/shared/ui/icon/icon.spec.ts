import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Icon } from '@app/shared/ui/icon/icon';
import { ICON_PATHS, IconName } from '@app/shared/ui/icon/icon-paths';

@Component({
  imports: [Icon],
  template: `<button type="button" aria-label="Notifications"><app-icon [name]="name()" [filled]="filled()" /></button>`
})
class Host {
  readonly name = signal<IconName>('bell');
  readonly filled = signal(false);
}

describe('Icon', () => {
  let fixture: ComponentFixture<Host>;

  it('draws the shapes of the icon it is given', () => {
    givenAButtonWithTheIcon('bell');

    thenTheIconDraws(ICON_PATHS.bell);

    whenTheIconBecomes('star');

    thenTheIconDraws(ICON_PATHS.star);
  });

  it('is decoration: hidden from assistive technology, the button keeps its own name', () => {
    givenAButtonWithTheIcon('bell');

    thenTheIconIsHiddenFromAssistiveTechnology();
    thenTheButtonIsNamed('Notifications');
  });

  it('can be filled (a full star)', () => {
    givenAButtonWithTheIcon('star');
    thenTheIconIsFilled(false);

    whenTheIconIsFilled();

    thenTheIconIsFilled(true);
  });

  function givenAButtonWithTheIcon(name: IconName): void {
    fixture = TestBed.createComponent(Host);
    fixture.componentInstance.name.set(name);
    fixture.detectChanges();
  }

  function whenTheIconBecomes(name: IconName): void {
    fixture.componentInstance.name.set(name);
    fixture.detectChanges();
  }

  function whenTheIconIsFilled(): void {
    fixture.componentInstance.filled.set(true);
    fixture.detectChanges();
  }

  function thenTheIconDraws(paths: readonly string[]): void {
    expect(Array.from(icon().querySelectorAll('path')).map((path) => path.getAttribute('d'))).toEqual([...paths]);
  }

  function thenTheIconIsHiddenFromAssistiveTechnology(): void {
    expect(icon().getAttribute('aria-hidden')).toBe('true');
  }

  function thenTheButtonIsNamed(name: string): void {
    expect(fixture.nativeElement.querySelector('button').getAttribute('aria-label')).toBe(name);
  }

  function thenTheIconIsFilled(filled: boolean): void {
    expect(icon().querySelector('svg')!.classList.contains('filled')).toBe(filled);
  }

  function icon(): HTMLElement {
    return fixture.nativeElement.querySelector('app-icon');
  }
});
