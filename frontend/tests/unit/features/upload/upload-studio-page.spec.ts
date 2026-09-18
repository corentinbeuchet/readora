import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { Subject, of } from 'rxjs';
import { UploadStudioPage, parseChapterNumber } from '@app/features/upload/upload-studio-page';
import { UploadService } from '@app/core/upload/upload.service';
import { PageUploadItem } from '@app/core/upload/file-utils';
import { environment } from '../../../../src/environments/environment';

const API = environment.apiUrl;
const WORK = { id: 'work-1', title: 'Blue Lock', synopsis: '', type: 'MANGA', status: 'ONGOING', coverImageUrl: '', genres: ['Action'] };
const ok = (data: unknown) => ({ success: true, data, error: null });
const fail = (error: string) => ({ success: false, data: null, error });

function page(id: string, pageNumber: number): PageUploadItem {
  return { id, file: new File([id], `${id}.png`, { type: 'image/png' }), previewUrl: '', pageNumber, status: 'pending', progress: 0 };
}

describe('UploadStudioPage', () => {
  let fixture: ComponentFixture<UploadStudioPage>;
  let component: UploadStudioPage;
  let uploadService: UploadService;

  beforeEach(async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [UploadStudioPage],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(UploadStudioPage);
    component = fixture.componentInstance;
    uploadService = TestBed.inject(UploadService);
    fixture.detectChanges();
  });

  it('initializes at step manga with default values', () => {
    expect(component.currentStep()).toBe('manga');
    expect(component.type()).toBe('MANGA');
    expect(component.status()).toBe('ONGOING');
    expect(component.chapterNumber()).toBe('1');
    expect(component.publishingMode()).toBe('DIRECT');
    expect(component.isMangaStepValid()).toBe(false);
  });

  it('validates manga step and blocks advancing when title is empty', () => {
    component.title.set('   ');
    component.nextFromManga();
    expect(component.currentStep()).toBe('manga');
    expect(component.errorMessage()).toContain('title');

    component.title.set('Solo Leveling');
    expect(component.isMangaStepValid()).toBe(true);
    component.nextFromManga();
    expect(component.currentStep()).toBe('chapter');
  });

  it('renders the publishing mode as a labelled native radio group', () => {
    component.title.set('Tower of God');
    component.nextFromManga();
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    const legend = [...el.querySelectorAll('legend')].map((l) => l.textContent?.trim());
    expect(legend).toContain('Publishing Pipeline');
    const radios = el.querySelectorAll<HTMLInputElement>('input[type="radio"][name="publishing-mode"]');
    expect(radios.length).toBe(2);
    expect(radios[0].checked).toBe(true);

    radios[1].click();
    fixture.detectChanges();
    expect(component.publishingMode()).toBe('SCANLATION');
    expect(radios[1].checked).toBe(true);
  });

  it('toggles genre selections and adds custom genres', () => {
    expect(component.selectedGenres()).toContain('Action');
    component.toggleGenre('Action');
    expect(component.selectedGenres()).not.toContain('Action');
    component.toggleGenre('Fantasy');
    expect(component.selectedGenres()).toContain('Fantasy');

    component.customGenreInput.set('Cyberpunk');
    component.addCustomGenre();
    expect(component.selectedGenres()).toContain('Cyberpunk');
  });

  it('navigates through steps when inputs are valid', () => {
    component.title.set('Tower of God');
    component.nextFromManga();
    expect(component.currentStep()).toBe('chapter');

    component.chapterNumber.set('1');
    component.nextFromChapter();
    expect(component.currentStep()).toBe('pages');

    // Pages step invalid when 0 pages
    expect(component.isPagesStepValid()).toBe(false);
    component.nextFromPages();
    expect(component.currentStep()).toBe('pages');

    // Add dummy page item
    const dummyPage: PageUploadItem = {
      id: 'p1',
      file: new File(['page1'], '01.png', { type: 'image/png' }),
      previewUrl: '',
      pageNumber: 1,
      status: 'pending',
      progress: 0,
    };
    component.pages.set([dummyPage]);
    expect(component.isPagesStepValid()).toBe(true);

    component.nextFromPages();
    expect(component.currentStep()).toBe('review');
  });

  it('submits upload workflow successfully in DIRECT mode', async () => {
    component.title.set('Omniscient Reader');
    component.synopsis.set('Only I know the end of this world');
    component.author.set('  Sing Shong ');
    component.demographic.set('SHOUNEN');
    component.chapterNumber.set('1');
    component.chapterTitle.set('Prologue');
    component.publishingMode.set('DIRECT');

    const dummyPage: PageUploadItem = {
      id: 'p1',
      file: new File(['page1'], '01.png', { type: 'image/png' }),
      previewUrl: '',
      pageNumber: 1,
      status: 'pending',
      progress: 0,
    };
    component.pages.set([dummyPage]);

    // Mock upload service methods
    vi.spyOn(uploadService, 'createWork').mockReturnValue(
      of({
        id: 'work-123',
        title: 'Omniscient Reader',
        synopsis: 'Only I know the end of this world',
        type: 'MANGA',
        status: 'ONGOING',
        coverImageUrl: '',
        genres: ['Action'],
      })
    );

    vi.spyOn(uploadService, 'uploadPagesBatch').mockReturnValue(
      of([
        {
          ...dummyPage,
          status: 'done',
          progress: 100,
          storageKey: 'scans/work-123/c1/p1.png',
          cdnUrl: 'https://cdn.readora.com/scans/work-123/c1/p1.png',
        },
      ])
    );

    vi.spyOn(uploadService, 'directPublishChapter').mockReturnValue(
      of({
        id: 'chap-999',
        workId: 'work-123',
        chapterNumber: '1',
        title: 'Prologue',
        status: 'PUBLISHED',
        pages: [],
      })
    );

    await component.submitUpload();

    expect(uploadService.createWork).toHaveBeenCalledWith(expect.objectContaining({ author: 'Sing Shong', demographic: 'SHOUNEN' }));
    expect(component.currentStep()).toBe('success');
    expect(component.createdWork()?.id).toBe('work-123');
    expect(component.createdChapterId()).toBe('chap-999');
  });

  describe('publish failures and retries (HTTP level)', () => {
    let http: HttpTestingController;

    beforeEach(() => {
      http = TestBed.inject(HttpTestingController);
      component.title.set('Blue Lock');
      component.chapterNumber.set('3');
      component.pages.set([page('p1', 1), page('p2', 2)]);
      component.goToStep('review');
      fixture.detectChanges();
    });

    afterEach(() => http.verify());

    const alertText = (): string => fixture.nativeElement.querySelector('[role="alert"]')?.textContent ?? '';
    const uploads = () => http.match((r) => r.url.startsWith(`${API}/storage/upload`));
    const uploadAll = () => uploads().forEach((r, i) => r.flush(ok({ storageKey: `k${i}`, cdnUrl: `https://cdn/k${i}` })));

    async function flushAsync(): Promise<void> {
      for (let i = 0; i < 5; i++) {
        await Promise.resolve();
      }
      fixture.detectChanges();
    }

    it('retries only the failed page and reuses the already created Work', async () => {
      let submit = component.submitUpload();
      await flushAsync();
      http.expectOne({ method: 'POST', url: `${API}/works` }).flush(ok(WORK));
      await flushAsync();
      const first = uploads();
      expect(first.length).toBe(2);
      expect(first[0].request.urlWithParams).toContain(encodeURIComponent('scans/work-1/c3'));
      first[0].flush(ok({ storageKey: 'k1', cdnUrl: 'https://cdn/k1' }));
      first[1].flush(fail('Storage unavailable'), { status: 503, statusText: 'Service Unavailable' });
      await submit;
      fixture.detectChanges();

      expect(component.currentStep()).toBe('review');
      expect(alertText()).toContain('1 of 2 pages failed to upload');
      expect(component.pages().map((p) => p.status)).toEqual(['done', 'error']);
      expect(fixture.nativeElement.querySelector('.retry-hint')?.textContent).toContain('Blue Lock');

      // Retry: no second POST /works, only the failed page is uploaded again.
      submit = component.submitUpload();
      await flushAsync();
      http.expectNone({ method: 'POST', url: `${API}/works` });
      const second = uploads();
      expect(second.length).toBe(1);
      second[0].flush(ok({ storageKey: 'k2', cdnUrl: 'https://cdn/k2' }));
      await flushAsync();

      const publish = http.expectOne(`${API}/works/work-1/chapters/direct`);
      expect(publish.request.body).toEqual({
        chapterNumber: '3',
        title: undefined,
        pages: [
          { pageNumber: 1, storageKey: 'k1', cdnUrl: 'https://cdn/k1', width: undefined, height: undefined },
          { pageNumber: 2, storageKey: 'k2', cdnUrl: 'https://cdn/k2', width: undefined, height: undefined },
        ],
      });
      publish.flush(ok({ id: 'chap-1', workId: 'work-1', chapterNumber: '3', title: '', status: 'PUBLISHED', pages: [] }));
      await submit;

      expect(component.currentStep()).toBe('success');
      expect(component.createdChapterId()).toBe('chap-1');
    });

    it('surfaces the API message when creating the Work fails, and retries it', async () => {
      let submit = component.submitUpload();
      await flushAsync();
      http.expectOne(`${API}/works`).flush(fail('Title already exists'), { status: 409, statusText: 'Conflict' });
      await submit;
      fixture.detectChanges();
      expect(alertText()).toContain('Title already exists');
      expect(component.createdWork()).toBeNull();

      submit = component.submitUpload();
      await flushAsync();
      http.expectOne(`${API}/works`).flush(ok(WORK));
      await flushAsync();
      uploadAll();
      await flushAsync();
      http.expectOne(`${API}/works/work-1/chapters/direct`).flush(ok({ id: 'chap-1', workId: 'work-1', chapterNumber: '3', title: '', status: 'PUBLISHED', pages: [] }));
      await submit;
      expect(component.currentStep()).toBe('success');
    });

    it('SCANLATION: reports a failed project lookup instead of swallowing it', async () => {
      component.publishingMode.set('SCANLATION');
      const submit = component.submitUpload();
      await flushAsync();
      http.expectOne(`${API}/works`).flush(ok(WORK));
      await flushAsync();
      uploadAll();
      await flushAsync();
      http.expectOne(`${API}/works/work-1/projects`).flush(fail('Access denied'), { status: 403, statusText: 'Forbidden' });
      await submit;
      fixture.detectChanges();

      expect(component.currentStep()).toBe('review');
      expect(alertText()).toContain('Access denied');
    });

    it('SCANLATION: explains when the series has no project, then creates the task on retry', async () => {
      component.publishingMode.set('SCANLATION');
      let submit = component.submitUpload();
      await flushAsync();
      http.expectOne(`${API}/works`).flush(ok(WORK));
      await flushAsync();
      uploadAll();
      await flushAsync();
      http.expectOne(`${API}/works/work-1/projects`).flush(ok([]));
      await submit;
      fixture.detectChanges();
      expect(alertText()).toContain('No scanlation project exists');

      submit = component.submitUpload();
      await flushAsync();
      http.expectOne(`${API}/works/work-1/projects`).flush(ok([{ id: 'proj-1' }]));
      await flushAsync();
      const task = http.expectOne((r) => r.method === 'POST' && r.url.endsWith('/tasks'));
      expect(task.request.body).toEqual({ chapterNumber: 3, assetUrl: 'https://cdn/k0', pageCount: 2 });
      task.flush(ok({ id: 'task-1' }));
      await submit;
      expect(component.currentStep()).toBe('success');
      expect(component.createdProjectId()).toBe('proj-1');
    });
  });

  it('validates chapter numbers instead of defaulting to 1', () => {
    expect(parseChapterNumber('12.5')).toBe('12.5');
    expect(parseChapterNumber(' 010 ')).toBe('10');
    for (const bad of ['', 'abc', '1abc', '0', '-2', '1e3', '1.']) {
      expect(parseChapterNumber(bad)).toBeNull();
    }

    component.title.set('Tower of God');
    component.nextFromManga();
    component.chapterNumber.set('1abc');
    component.nextFromChapter();
    expect(component.currentStep()).toBe('chapter');
    expect(component.errorMessage()).toContain('positive number');
  });

  describe('object URL lifecycle', () => {
    let revoked: string[];
    let n: number;

    beforeEach(() => {
      revoked = [];
      n = 0;
      vi.spyOn(URL, 'createObjectURL').mockImplementation(() => `blob:cover/${++n}`);
      vi.spyOn(URL, 'revokeObjectURL').mockImplementation((url: string) => void revoked.push(url));
    });

    afterEach(() => vi.restoreAllMocks());

    /** Picks a cover through the cover picker's (visually hidden) file input. */
    const selectCover = (name: string): void => {
      fixture.detectChanges();
      const input: HTMLInputElement = fixture.nativeElement.querySelector('app-cover-picker input[type="file"]');
      Object.defineProperty(input, 'files', { value: [new File(['x'], name, { type: 'image/png' })], configurable: true });
      input.dispatchEvent(new Event('change'));
      fixture.detectChanges();
    };
    const changeCover = (): void => {
      (fixture.nativeElement.querySelector('.remove-cover-btn') as HTMLButtonElement).click();
      fixture.detectChanges();
    };

    it('revokes the cover preview when it is changed or removed', () => {
      selectCover('a.png');
      expect(fixture.nativeElement.querySelector('app-cover-picker img').getAttribute('src')).toBe('blob:cover/1');
      changeCover();
      expect(revoked).toEqual(['blob:cover/1']);
      selectCover('b.png');
      changeCover();
      expect(revoked).toEqual(['blob:cover/1', 'blob:cover/2']);
      expect(component.coverPreviewUrl()).toBe('');
    });

    it('revokes cover and page previews on reset and on destroy', () => {
      selectCover('a.png');
      component.pages.set([{ ...page('p1', 1), previewUrl: 'blob:page/1' }]);
      component.resetStudio();
      expect(revoked).toEqual(['blob:cover/1', 'blob:page/1']);

      selectCover('b.png');
      component.pages.set([{ ...page('p2', 1), previewUrl: 'blob:page/2' }]);
      fixture.destroy();
      expect(revoked).toEqual(['blob:cover/1', 'blob:page/1', 'blob:cover/2', 'blob:page/2']);
    });
  });

  it('exposes genre toggles as pressed buttons and the upload progress as a progressbar', async () => {
    const action = Array.from(fixture.nativeElement.querySelectorAll('.genre-pill') as NodeListOf<HTMLButtonElement>).find((b) => b.textContent?.trim() === 'Action')!;
    expect(action.getAttribute('aria-pressed')).toBe('true');
    action.click();
    fixture.detectChanges();
    expect(action.getAttribute('aria-pressed')).toBe('false');

    component.title.set('Blue Lock');
    component.pages.set([page('p1', 1)]);
    component.goToStep('review');
    vi.spyOn(uploadService, 'createWork').mockReturnValue(new Subject<never>());
    void component.submitUpload();
    fixture.detectChanges();

    const bar: HTMLElement = fixture.nativeElement.querySelector('[role="progressbar"]');
    expect(bar.getAttribute('aria-valuemin')).toBe('0');
    expect(bar.getAttribute('aria-valuemax')).toBe('100');
    expect(Number(bar.getAttribute('aria-valuenow'))).toBe(component.uploadProgress());
    expect(bar.getAttribute('aria-valuetext')).toContain('Creating series in catalog');
  });

  it('step indicator marks the current step and only enables reachable steps', () => {
    const buttons = (): HTMLButtonElement[] => Array.from(fixture.nativeElement.querySelectorAll('app-wizard-steps button'));
    expect(buttons().map((b) => b.disabled)).toEqual([false, true, true, true]);
    expect(buttons()[0].getAttribute('aria-current')).toBe('step');

    component.title.set('Tower of God');
    fixture.detectChanges();
    expect(buttons().map((b) => b.disabled)).toEqual([false, false, false, true]);

    buttons()[1].click();
    fixture.detectChanges();
    expect(component.currentStep()).toBe('chapter');
    expect(buttons()[1].getAttribute('aria-current')).toBe('step');
    expect(buttons()[0].classList.contains('completed')).toBe(true);
  });
});
