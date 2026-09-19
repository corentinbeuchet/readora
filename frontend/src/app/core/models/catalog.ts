export type WorkType = 'MANGA' | 'MANHWA' | 'MANHUA' | 'COMIC';

export type WorkStatus = 'ONGOING' | 'COMPLETED' | 'HIATUS';

export type Demographic = 'SHOUNEN' | 'SHOUJO' | 'SEINEN' | 'JOSEI';

export interface Work {
  id: string;
  title: string;
  synopsis: string;
  type: WorkType;
  status: WorkStatus;
  author?: string | null;
  demographic?: Demographic | null;
  coverImageUrl: string;
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
}

export interface WorkSummary {
  id: string;
  title: string;
  type: Work['type'];
  status: Work['status'];
  author?: string | null;
  demographic?: Demographic | null;
  coverImageUrl: string;
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
