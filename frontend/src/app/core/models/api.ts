export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error: string | null;
  /** Stable code for `error` (backend `ErrorCodes`); translated by `errorMessageForCode`. */
  code: string | null;
}

export interface PagedResponse<T> {
  items: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}
