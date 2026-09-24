import { ComponentFixture, TestBed } from '@angular/core/testing';
import { WorkCover } from '@app/shared/ui/work-cover/work-cover';

const COVER = 'https://cdn.readora.test/covers/c1-cover.png';
const THUMBNAIL = `${COVER}.thumb.jpg`;

describe('WorkCover', () => {
  let fixture: ComponentFixture<WorkCover>;

  it('shows the thumbnail when the series has one', () => {
    givenACover({ src: COVER, thumbnail: THUMBNAIL });

    thenTheImageIs(THUMBNAIL);
  });

  it('shows the full cover when the series has no thumbnail (a cover hosted elsewhere)', () => {
    givenACover({ src: COVER, thumbnail: null });

    thenTheImageIs(COVER);
  });

  it('falls back to the full cover when the thumbnail fails to load', () => {
    givenACover({ src: COVER, thumbnail: THUMBNAIL });

    whenTheImageFailsToLoad();

    thenTheImageIs(COVER);
  });

  it('shows the screentone placeholder when the full cover fails to load too', () => {
    givenACover({ src: COVER, thumbnail: THUMBNAIL });

    whenTheImageFailsToLoad();
    whenTheImageFailsToLoad();

    thenThePlaceholderIsShown();
    thenNoImageIsLoaded();
  });

  it('shows the placeholder, named by the alt text, when the series has no cover', () => {
    givenACover({ src: null, thumbnail: null, alt: 'Cover of Solo Leveling' });

    thenThePlaceholderIsShown();
    thenThePlaceholderIsNamed('Cover of Solo Leveling');
  });

  function givenACover(inputs: { src: string | null; thumbnail: string | null; alt?: string }): void {
    fixture = TestBed.createComponent(WorkCover);
    fixture.componentRef.setInput('src', inputs.src);
    fixture.componentRef.setInput('thumbnail', inputs.thumbnail);
    fixture.componentRef.setInput('alt', inputs.alt ?? '');
    fixture.componentRef.setInput('width', 72);
    fixture.componentRef.setInput('height', 101);
    fixture.detectChanges();
  }

  function whenTheImageFailsToLoad(): void {
    image().dispatchEvent(new Event('error'));
    fixture.detectChanges();
  }

  function thenTheImageIs(url: string): void {
    expect(image().getAttribute('src')).toBe(url);
  }

  function thenThePlaceholderIsShown(): void {
    expect(placeholder()).not.toBeNull();
  }

  function thenNoImageIsLoaded(): void {
    expect(image()).toBeNull();
  }

  function thenThePlaceholderIsNamed(name: string): void {
    expect(placeholder()!.getAttribute('role')).toBe('img');
    expect(placeholder()!.getAttribute('aria-label')).toBe(name);
  }

  function placeholder(): HTMLElement | null {
    return (fixture.nativeElement as HTMLElement).querySelector('.placeholder');
  }

  function image(): HTMLImageElement {
    return (fixture.nativeElement as HTMLElement).querySelector('img')!;
  }
});
