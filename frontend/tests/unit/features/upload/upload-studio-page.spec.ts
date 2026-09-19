import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { UploadStudioPage, parseChapterNumber } from '@app/features/upload/upload-studio-page';
import { API, fail, ok, provideHttpTesting } from '../../test-utils';

const WORK = { id: 'work-1', title: 'Blue Lock', synopsis: '', type: 'MANGA', status: 'ONGOING', coverImageUrl: '', genres: ['Action'] };
const CHAPTER = { id: 'chap-1', workId: 'work-1', chapterNumber: '3', title: '', status: 'PUBLISHED', pages: [] };

/** Image double: page dimensions "decode" right away as 800 × 1200. */
class FakeImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  naturalWidth = 800;
  naturalHeight = 1200;
  set src(_: string) {
    queueMicrotask(() => this.onload?.());
  }
}

/**
 * The studio driven like a user: fields are typed into, buttons clicked, pages added through the file input, and the
 * API answered at the HTTP level. Nothing reads or calls the component's own members.
 */
describe('UploadStudioPage', () => {
  let fixture: ComponentFixture<UploadStudioPage>;
  let http: HttpTestingController;
  let created: string[];
  let revoked: string[];

  beforeEach(async () => {
    created = [];
    revoked = [];
    vi.stubGlobal('Image', FakeImage);
    vi.spyOn(URL, 'createObjectURL').mockImplementation(() => {
      const url = `blob:test/${created.length + 1}`;
      created.push(url);
      return url;
    });
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation((url: string) => void revoked.push(url));
    await TestBed.configureTestingModule({
      imports: [UploadStudioPage],
      providers: [...provideHttpTesting(), provideRouter([])]
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(UploadStudioPage);
    fixture.detectChanges();
  });

  afterEach(() => {
    http.verify();
  });

  const el = (): HTMLElement => fixture.nativeElement;
  const heading = (): string => el().querySelector('.wizard-card h2')?.textContent?.trim() ?? '';
  const alertText = (): string => el().querySelector('.studio-alert')?.textContent ?? '';

  async function flush(): Promise<void> {
    for (let i = 0; i < 6; i++) {
      await Promise.resolve();
    }
    fixture.detectChanges();
  }

  function type(selector: string, value: string): void {
    const field = el().querySelector(selector) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
    field.value = value;
    field.dispatchEvent(new Event('input'));
    field.dispatchEvent(new Event('change'));
    field.dispatchEvent(new Event('blur'));
    fixture.detectChanges();
  }

  function button(label: string): HTMLButtonElement {
    const found = Array.from(el().querySelectorAll('button')).find((b) => b.textContent?.includes(label));
    if (!found) throw new Error(`No button "${label}"`);
    return found;
  }

  function click(label: string): void {
    button(label).click();
    fixture.detectChanges();
  }

  async function addPages(...names: string[]): Promise<void> {
    const input = el().querySelector('app-page-grid-uploader input[type="file"]') as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: names.map((n) => new File([n], n, { type: 'image/png' })), configurable: true });
    input.dispatchEvent(new Event('change'));
    await flush();
  }

  /** Series "Blue Lock", chapter 3 with two pages, on the review step. */
  async function toReview(mode: 'DIRECT' | 'SCANLATION' = 'DIRECT'): Promise<void> {
    type('#manga-title', 'Blue Lock');
    click('Next: Chapter Setup');
    type('#chapter-number', '3');
    if (mode === 'SCANLATION') {
      (el().querySelector('input[value="SCANLATION"]') as HTMLInputElement).click();
      fixture.detectChanges();
    }
    click('Next: Upload Pages');
    await addPages('p1.png', 'p2.png');
    click('Next: Review');
  }

  const uploads = () => http.match((r) => r.url.startsWith(`${API}/storage/upload`));
  const uploadAll = () => uploads().forEach((r, i) => r.flush(ok({ storageKey: `k${i}`, cdnUrl: `https://cdn/k${i}` })));

  it('starts on the series step with defaults, and moves on only once the title is filled', async () => {
    await flush();
    expect(heading()).toBe('1. Manga / Series Information');
    expect((el().querySelector('#manga-type') as HTMLSelectElement).value).toBe('MANGA');
    expect((el().querySelector('#manga-status') as HTMLSelectElement).value).toBe('ONGOING');
    expect(button('Next: Chapter Setup').disabled).toBe(true);

    type('#manga-title', '   ');
    expect(button('Next: Chapter Setup').disabled).toBe(true);
    expect(el().querySelector('#manga-title-error')!.textContent).toContain('Give the series a title');

    type('#manga-title', 'Solo Leveling');
    click('Next: Chapter Setup');
    await flush();
    expect(heading()).toBe('2. Initial Chapter Details');
    expect((el().querySelector('#chapter-number') as HTMLInputElement).value).toBe('1');
  });

  it('renders the publishing mode as a labelled native radio group', () => {
    type('#manga-title', 'Tower of God');
    click('Next: Chapter Setup');

    const legends = Array.from(el().querySelectorAll('legend')).map((l) => l.textContent?.trim());
    expect(legends).toContain('Publishing Pipeline');
    const radios = el().querySelectorAll<HTMLInputElement>('input[type="radio"][name="publishing-mode"]');
    expect(radios.length).toBe(2);
    expect(radios[0].checked).toBe(true);

    radios[1].click();
    fixture.detectChanges();
    expect(radios[1].checked).toBe(true);
    expect(el().querySelectorAll('.mode-card')[1].classList).toContain('selected');
  });

  it('toggles genres as pressed buttons and adds custom genres', () => {
    const pill = (name: string) => Array.from(el().querySelectorAll<HTMLButtonElement>('.genre-pill')).find((b) => b.textContent?.trim() === name);
    expect(pill('Action')!.getAttribute('aria-pressed')).toBe('true');
    pill('Action')!.click();
    pill('Fantasy')!.click();
    fixture.detectChanges();
    expect(pill('Action')!.getAttribute('aria-pressed')).toBe('false');
    expect(pill('Fantasy')!.getAttribute('aria-pressed')).toBe('true');

    type('input[aria-label="Custom genre"]', 'Cyberpunk');
    click('Add');
    type('#manga-title', 'Neon');
    click('Next: Chapter Setup');
    click('Next: Upload Pages');
    expect(button('Next: Review').disabled).toBe(true);
    return addPages('p1.png').then(() => {
      click('Next: Review');
      expect(el().querySelector('.review-summary')?.textContent).toContain('Fantasy, Cyberpunk');
    });
  });

  it('only accepts a positive chapter number (never defaults to 1)', () => {
    expect(parseChapterNumber('12.5')).toBe('12.5');
    expect(parseChapterNumber(' 010 ')).toBe('10');
    for (const bad of ['', 'abc', '1abc', '0', '-2', '1e3', '1.']) {
      expect(parseChapterNumber(bad)).toBeNull();
    }

    type('#manga-title', 'Tower of God');
    click('Next: Chapter Setup');
    type('#chapter-number', '1abc');
    expect(button('Next: Upload Pages').disabled).toBe(true);
    expect(el().querySelector('#chapter-number')!.getAttribute('aria-invalid')).toBe('true');
    expect(el().querySelector('#chapter-number-error')!.textContent).toContain('positive number such as 1, 10 or 12.5');
    type('#chapter-number', '12.5');
    click('Next: Upload Pages');
    expect(heading()).toBe('3. Chapter Pages');
  });

  it('step indicator marks the current step and only enables reachable steps', () => {
    const steps = (): HTMLButtonElement[] => Array.from(el().querySelectorAll('app-wizard-steps button'));
    expect(steps().map((b) => b.disabled)).toEqual([false, true, true, true]);
    expect(steps()[0].getAttribute('aria-current')).toBe('step');

    type('#manga-title', 'Tower of God');
    expect(steps().map((b) => b.disabled)).toEqual([false, false, false, true]);

    steps()[1].click();
    fixture.detectChanges();
    expect(heading()).toBe('2. Initial Chapter Details');
    expect(steps()[1].getAttribute('aria-current')).toBe('step');
    expect(steps()[0].classList.contains('completed')).toBe(true);
  });

  it('publishes directly: creates the series, uploads the pages, publishes the chapter', async () => {
    type('#manga-title', 'Omniscient Reader');
    type('#manga-author', '  Sing Shong ');
    type('#manga-demographic', 'SHOUNEN');
    type('#manga-synopsis', 'Only I know the end of this world');
    click('Next: Chapter Setup');
    type('#chapter-number', '1');
    type('#chapter-title', 'Prologue');
    click('Next: Upload Pages');
    await addPages('p1.png');
    click('Next: Review');
    click('Publish Series');
    await flush();

    const createWork = http.expectOne({ method: 'POST', url: `${API}/works` });
    expect(createWork.request.body).toMatchObject({ title: 'Omniscient Reader', author: 'Sing Shong', demographic: 'SHOUNEN', synopsis: 'Only I know the end of this world' });
    createWork.flush(ok({ ...WORK, id: 'work-123', title: 'Omniscient Reader' }));
    await flush();
    uploadAll();
    await flush();
    const publish = http.expectOne(`${API}/works/work-123/chapters/direct`);
    expect(publish.request.body).toMatchObject({ chapterNumber: '1', title: 'Prologue' });
    publish.flush(ok({ ...CHAPTER, id: 'chap-999', workId: 'work-123' }));
    await flush();

    expect(heading()).toBe('Series & Chapter Uploaded Successfully!');
    const links = Array.from(el().querySelectorAll('.success-actions a')).map((a) => a.getAttribute('href'));
    expect(links).toEqual(['/read/chap-999', '/works/work-123']);
  });

  it('shows the upload progress as a progressbar while publishing', async () => {
    await toReview();
    click('Publish Series');
    await flush();

    const bar: HTMLElement = el().querySelector('[role="progressbar"]')!;
    expect(bar.getAttribute('aria-valuemin')).toBe('0');
    expect(bar.getAttribute('aria-valuemax')).toBe('100');
    expect(Number(bar.getAttribute('aria-valuenow'))).toBeGreaterThan(0);
    expect(bar.getAttribute('aria-valuetext')).toContain('Creating series in catalog');

    http.expectOne(`${API}/works`).flush(fail('down'), { status: 503, statusText: 'Unavailable' });
    await flush();
  });

  describe('publish failures and retries (HTTP level)', () => {
    beforeEach(() => toReview());

    it('retries only the failed page and reuses the already created Work', async () => {
      click('Publish Series');
      await flush();
      http.expectOne({ method: 'POST', url: `${API}/works` }).flush(ok(WORK));
      await flush();
      const first = uploads();
      expect(first.length).toBe(2);
      expect(first[0].request.urlWithParams).toContain(encodeURIComponent('scans/work-1/c3'));
      first[0].flush(ok({ storageKey: 'k1', cdnUrl: 'https://cdn/k1', liteCdnUrl: 'https://cdn/k1.lite.jpg' }));
      first[1].flush(fail('Storage unavailable'), { status: 503, statusText: 'Service Unavailable' });
      await flush();

      expect(heading()).toBe('4. Review & Confirmation');
      expect(alertText()).toContain('1 of 2 pages failed to upload');
      expect(el().querySelector('.retry-hint')?.textContent).toContain('Blue Lock');

      // Retry: no second POST /works, only the failed page is uploaded again.
      click('Publish Series');
      await flush();
      http.expectNone({ method: 'POST', url: `${API}/works` });
      const second = uploads();
      expect(second.length).toBe(1);
      second[0].flush(ok({ storageKey: 'k2', cdnUrl: 'https://cdn/k2' }));
      await flush();

      const publish = http.expectOne(`${API}/works/work-1/chapters/direct`);
      expect(publish.request.body).toEqual({
        chapterNumber: '3',
        title: undefined,
        pages: [
          { pageNumber: 1, storageKey: 'k1', cdnUrl: 'https://cdn/k1', width: 800, height: 1200, description: undefined, liteCdnUrl: 'https://cdn/k1.lite.jpg' },
          { pageNumber: 2, storageKey: 'k2', cdnUrl: 'https://cdn/k2', width: 800, height: 1200 }
        ]
      });
      publish.flush(ok(CHAPTER));
      await flush();
      expect(heading()).toBe('Series & Chapter Uploaded Successfully!');
      expect(el().querySelector('.success-actions a')?.getAttribute('href')).toBe('/read/chap-1');
    });

    it('surfaces the API message when creating the Work fails, and retries it', async () => {
      click('Publish Series');
      await flush();
      http.expectOne(`${API}/works`).flush(fail('Title already exists'), { status: 409, statusText: 'Conflict' });
      await flush();
      expect(alertText()).toContain('Title already exists');
      expect(el().querySelector('.retry-hint')).toBeNull();

      click('Publish Series');
      await flush();
      http.expectOne(`${API}/works`).flush(ok(WORK));
      await flush();
      uploadAll();
      await flush();
      http.expectOne(`${API}/works/work-1/chapters/direct`).flush(ok(CHAPTER));
      await flush();
      expect(heading()).toBe('Series & Chapter Uploaded Successfully!');
    });
  });

  describe('scanlation mode', () => {
    beforeEach(() => toReview('SCANLATION'));

    it('reports a failed project lookup instead of swallowing it', async () => {
      click('Publish Series');
      await flush();
      http.expectOne(`${API}/works`).flush(ok(WORK));
      await flush();
      uploadAll();
      await flush();
      http.expectOne(`${API}/works/work-1/projects`).flush(fail('Access denied'), { status: 403, statusText: 'Forbidden' });
      await flush();

      expect(heading()).toBe('4. Review & Confirmation');
      expect(alertText()).toContain('Access denied');
    });

    it('explains when the series has no project, then creates the task on retry', async () => {
      click('Publish Series');
      await flush();
      http.expectOne(`${API}/works`).flush(ok(WORK));
      await flush();
      uploadAll();
      await flush();
      http.expectOne(`${API}/works/work-1/projects`).flush(ok([]));
      await flush();
      expect(alertText()).toContain('No scanlation project exists');

      click('Publish Series');
      await flush();
      http.expectOne(`${API}/works/work-1/projects`).flush(ok([{ id: 'proj-1' }]));
      await flush();
      const task = http.expectOne((r) => r.method === 'POST' && r.url.endsWith('/tasks'));
      expect(task.request.body).toEqual({ chapterNumber: 3, assetUrl: 'https://cdn/k0', pageCount: 2 });
      task.flush(ok({ id: 'task-1' }));
      await flush();
      expect(heading()).toBe('Series & Chapter Uploaded Successfully!');
      expect(Array.from(el().querySelectorAll('.success-actions a')).map((a) => a.getAttribute('href'))).toContain('/scanlation/proj-1');
    });
  });

  describe('object URL lifecycle', () => {
    /** Picks a cover through the cover picker's (visually hidden) file input. */
    const selectCover = (name: string): void => {
      const input: HTMLInputElement = el().querySelector('app-cover-picker input[type="file"]')!;
      Object.defineProperty(input, 'files', { value: [new File(['x'], name, { type: 'image/png' })], configurable: true });
      input.dispatchEvent(new Event('change'));
      fixture.detectChanges();
    };
    const removeCover = (): void => click('Change Cover');

    it('revokes the cover preview when it is changed or removed', () => {
      selectCover('a.png');
      expect(el().querySelector('app-cover-picker img')!.getAttribute('src')).toBe('blob:test/1');
      removeCover();
      expect(revoked).toEqual(['blob:test/1']);
      selectCover('b.png');
      removeCover();
      expect(revoked).toEqual(['blob:test/1', 'blob:test/2']);
      expect(el().querySelector('app-cover-picker img')).toBeNull();
    });

    it('revokes cover and page previews when starting over, and on destroy', async () => {
      selectCover('a.png');
      await toReview();
      click('Publish Series');
      await flush();
      http.expectOne(`${API}/storage/upload?folder=covers`).flush(ok({ storageKey: 'c', cdnUrl: 'https://cdn/c' }));
      await flush();
      http.expectOne(`${API}/works`).flush(ok(WORK));
      await flush();
      uploadAll();
      await flush();
      http.expectOne(`${API}/works/work-1/chapters/direct`).flush(ok(CHAPTER));
      await flush();
      const beforeReset = [...created];

      click('Upload Another Manga');
      expect(revoked).toEqual(beforeReset);
      expect(heading()).toBe('1. Manga / Series Information');

      selectCover('b.png');
      type('#manga-title', 'Again');
      click('Next: Chapter Setup');
      click('Next: Upload Pages');
      await addPages('p9.png');
      fixture.destroy();
      expect(revoked).toEqual(created);
    });
  });
});
