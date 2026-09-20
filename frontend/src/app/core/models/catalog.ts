export type WorkType = 'MANGA' | 'MANHWA' | 'MANHUA' | 'COMIC';

export type WorkStatus = 'ONGOING' | 'COMPLETED' | 'HIATUS';

export type Demographic = 'SHOUNEN' | 'SHOUJO' | 'SEINEN' | 'JOSEI';

/** The language a series was first published in (not the language of its translations). */
export type OriginalLanguage = 'JAPANESE' | 'KOREAN' | 'CHINESE' | 'ENGLISH' | 'FRENCH' | 'OTHER';

/** Who a series is suitable for, as its translators rate it: information only, nothing is hidden by it. */
export type ContentRating = 'ALL_AGES' | 'TEEN' | 'MATURE';

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

export const ORIGINAL_LANGUAGE_LABELS: Record<OriginalLanguage, string> = {
  JAPANESE: $localize`:@@originalLanguage.japanese:Japanese`,
  KOREAN: $localize`:@@originalLanguage.korean:Korean`,
  CHINESE: $localize`:@@originalLanguage.chinese:Chinese`,
  ENGLISH: $localize`:@@originalLanguage.english:English`,
  FRENCH: $localize`:@@originalLanguage.french:French`,
  OTHER: $localize`:@@originalLanguage.other:Another language`
};

export const CONTENT_RATING_LABELS: Record<ContentRating, string> = {
  ALL_AGES: $localize`:@@contentRating.allAges:All ages`,
  TEEN: $localize`:@@contentRating.teen:Teen (13+)`,
  MATURE: $localize`:@@contentRating.mature:Mature (17+)`
};

/** What a series page says beside the synopsis (US-04). Every fact is optional: `null` or no title = not filled in. */
export interface WorkFacts {
  alternativeTitles: string[];
  artist: string | null;
  releaseYear: number | null;
  originalLanguage: OriginalLanguage | null;
  contentRating: ContentRating | null;
}

/** The facts as a request sends them: what is left out is unknown. */
export interface WorkFactsPayload {
  alternativeTitles: string[];
  artist?: string;
  releaseYear?: number;
  originalLanguage?: OriginalLanguage;
  contentRating?: ContentRating;
}

/** The facts as a form holds them: texts, one other title per line, `''` for "not specified". */
export interface WorkFactsDraft {
  alternativeTitles: string;
  artist: string;
  releaseYear: string;
  originalLanguage: OriginalLanguage | '';
  contentRating: ContentRating | '';
}

export const MAX_ALTERNATIVE_TITLES = 10;
export const MIN_RELEASE_YEAR = 1900;
export const MAX_RELEASE_YEAR = 2100;

export const NO_FACTS_DRAFT: WorkFactsDraft = { alternativeTitles: '', artist: '', releaseYear: '', originalLanguage: '', contentRating: '' };

export function factsDraftOf(facts: WorkFacts): WorkFactsDraft {
  return {
    alternativeTitles: facts.alternativeTitles.join('\n'),
    artist: facts.artist ?? '',
    releaseYear: facts.releaseYear === null ? '' : String(facts.releaseYear),
    originalLanguage: facts.originalLanguage ?? '',
    contentRating: facts.contentRating ?? ''
  };
}

/** One title per line: trimmed, without blanks or repeats (whatever the case), in the order typed. */
export function otherTitlesOf(text: string): string[] {
  const titles = new Map<string, string>();
  for (const title of text.split('\n').map((line) => line.trim())) {
    if (title && !titles.has(title.toLowerCase())) {
      titles.set(title.toLowerCase(), title);
    }
  }
  return [...titles.values()];
}

/** The year typed, or `null` when it is not a year between 1900 and 2100 (`''` is "unknown", also `null`). */
export function releaseYearOf(text: string): number | null {
  const year = /^\d{4}$/.test(text.trim()) ? Number(text.trim()) : null;
  return year !== null && year >= MIN_RELEASE_YEAR && year <= MAX_RELEASE_YEAR ? year : null;
}

export function factsPayloadOf(draft: WorkFactsDraft): WorkFactsPayload {
  const artist = draft.artist.trim();
  const year = releaseYearOf(draft.releaseYear);
  return {
    alternativeTitles: otherTitlesOf(draft.alternativeTitles),
    ...(artist ? { artist } : {}),
    ...(year !== null ? { releaseYear: year } : {}),
    ...(draft.originalLanguage ? { originalLanguage: draft.originalLanguage } : {}),
    ...(draft.contentRating ? { contentRating: draft.contentRating } : {})
  };
}

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
  facts: WorkFacts;
}

/** The whole description of a series, as `PUT /works/{id}` replaces it: what is left out is emptied. */
export interface UpdateWorkPayload {
  title: string;
  synopsis: string;
  type: WorkType;
  status: WorkStatus;
  author?: string;
  demographic?: Demographic;
  coverImageUrl?: string;
  genres: string[];
  facts: WorkFactsPayload;
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
  facts?: WorkFactsPayload;
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
