import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { DownloadData } from '@app/features/profile/profile-page/download-data/download-data';
import { API, provideHttpTesting, settle } from '../../../../test-utils';

describe('DownloadData (US-15)', () => {
  let fixture: ComponentFixture<DownloadData>;
  let http: HttpTestingController;
  let saveFile: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DownloadData],
      providers: [...provideHttpTesting()]
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(DownloadData);
    // The download is the component's browser side effect, replaced so nothing is written.
    saveFile = vi.spyOn(fixture.componentInstance as unknown as { saveFile: (file: Blob, name: string) => void }, 'saveFile')
      .mockImplementation(() => undefined);
    await settle(fixture);
  });

  afterEach(() => http.verify());

  it('downloads my data as readora-account.json and says so', async () => {
    await whenIDownloadMyData();
    await whenTheFileArrives();

    thenTheFileWasSavedAs('readora-account.json');
    thenTheStatusSays('Your data is downloaded (readora-account.json).');
  });

  it('a download that cannot reach the server is explained and nothing is saved', async () => {
    await whenIDownloadMyData();
    await whenTheDownloadFails();

    thenTheAlertSays('Cannot reach the server.');
    thenNothingWasSaved();
  });

  async function whenIDownloadMyData(): Promise<void> {
    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('button')!.click();
    await settle(fixture);
  }

  async function whenTheFileArrives(): Promise<void> {
    http.expectOne(`${API}/account/export`).flush(new Blob(['{}'], { type: 'application/json' }));
    await settle(fixture);
  }

  async function whenTheDownloadFails(): Promise<void> {
    http.expectOne(`${API}/account/export`).error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });
    await settle(fixture);
  }

  function thenTheFileWasSavedAs(name: string): void {
    expect(saveFile).toHaveBeenCalledWith(expect.any(Blob), name);
  }

  function thenNothingWasSaved(): void {
    expect(saveFile).not.toHaveBeenCalled();
  }

  function thenTheStatusSays(text: string): void {
    expect((fixture.nativeElement as HTMLElement).querySelector('[role="status"]')!.textContent!.trim()).toBe(text);
  }

  function thenTheAlertSays(text: string): void {
    expect((fixture.nativeElement as HTMLElement).querySelector('[role="alert"]')!.textContent).toContain(text);
  }
});
