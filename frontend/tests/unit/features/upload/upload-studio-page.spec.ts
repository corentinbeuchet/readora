import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { UploadStudioPage } from '@app/features/upload/upload-studio-page';
import { UploadService } from '@app/core/upload/upload.service';
import { PageUploadItem } from '@app/core/upload/file-utils';

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

    expect(component.currentStep()).toBe('success');
    expect(component.createdWork()?.id).toBe('work-123');
    expect(component.createdChapterId()).toBe('chap-999');
  });
});
