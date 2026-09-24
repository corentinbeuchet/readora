import { ComponentFixture, TestBed } from '@angular/core/testing';
import { WorkCover } from '@app/shared/ui/work-cover/work-cover';
import { FALLBACK_COVER_IMAGE } from '@app/core/utils/image-utils';

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

  it('shows the placeholder when the full cover fails to load too', () => {
    givenACover({ src: COVER, thumbnail: THUMBNAIL });

    whenTheImageFailsToLoad();
    whenTheImageFailsToLoad();

    thenTheImageIs(FALLBACK_COVER_IMAGE);
  });

  function givenACover(inputs: { src: string | null; thumbnail: string | null }): void {
    fixture = TestBed.createComponent(WorkCover);
    fixture.componentRef.setInput('src', inputs.src);
    fixture.componentRef.setInput('thumbnail', inputs.thumbnail);
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

  function image(): HTMLImageElement {
    return (fixture.nativeElement as HTMLElement).querySelector('img')!;
  }
});
