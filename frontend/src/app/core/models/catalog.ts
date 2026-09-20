export type WorkType = 'MANGA' | 'MANHWA' | 'MANHUA' | 'COMIC';

export type WorkStatus = 'ONGOING' | 'COMPLETED' | 'HIATUS';

export type Demographic = 'SHOUNEN' | 'SHOUJO' | 'SEINEN' | 'JOSEI';

/** Display names for the enum values above (the API sends the codes). */
export const WORK_TYPE_LABELS: Record<WorkType, string> = {
  MANGA: $localize`:@@workType.manga:Manga`,
  MANHWA: $localize`:@@workType.manhwa:Manhwa`,
  MANHUA: $localize`:@@workType.manhua:Manhua`,
  COMIC: $localize`:@@workType.comic:Comic`
};

export const WORK_STATUS_LABELS: Record<WorkStatus, string> = {
  ONGOING: $localize`:@@workStatus.ongoing:Ongoing`,
  COMPLETED: $localize`:@@workStatus.completed:Completed`,
  HIATUS: $localize`:@@workStatus.hiatus:On hiatus`
};

export const DEMOGRAPHIC_LABELS: Record<Demographic, string> = {
  SHOUNEN: $localize`:@@demographic.shounen:Shounen`,
  SHOUJO: $localize`:@@demographic.shoujo:Shoujo`,
  SEINEN: $localize`:@@demographic.seinen:Seinen`,
  JOSEI: $localize`:@@demographic.josei:Josei`
};

export interface Work {
  id: string;
  title: string;
  synopsis: string;
  type: WorkType;
  status: WorkStatus;
  author: string | null;
  demographic: Demographic | null;
  coverImageUrl: string | null;
  genres: string[];
}

export interface CreateWorkPayload {
  title: string;
  synopsis: string;
  type: WorkType;
  status: WorkStatus;
  author?: string;
  demographic?: Demographic;
  coverImageUrl?: string;
  genres: string[];
  /** One of the teams I lead; left out, the series gets a new team of its own. */
  teamId?: string;
}

export interface WorkSummary {
  id: string;
  title: string;
  type: Work['type'];
  status: Work['status'];
  author: string | null;
  demographic: Demographic | null;
  coverImageUrl: string | null;
  genres: string[];
}

/** Catalog filters (`GET /works`). Every `genres` entry is required, no `excludedGenres` entry may be present. */
export interface CatalogQuery {
  text?: string;
  genres?: readonly string[];
  excludedGenres?: readonly string[];
  type?: WorkType;
  status?: WorkStatus;
  demographic?: Demographic;
  page: number;
  size: number;
}
