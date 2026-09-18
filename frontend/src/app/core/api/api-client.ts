import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { Observable, catchError, map, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/readora.models';

/** Normalised error raised by every API client. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly source?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }

  get isUnauthorized(): boolean {
    return this.status === 401;
  }

  get isForbidden(): boolean {
    return this.status === 403;
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }
}

/** Array values become repeated parameters (`?genre=a&genre=b`). */
export type QueryParams = Record<string, string | number | boolean | readonly string[] | null | undefined>;

export interface RequestOptions {
  params?: QueryParams;
  withCredentials?: boolean;
}

/**
 * Thin wrapper around HttpClient that knows the backend base URL, unwraps the
 * `ApiResponse<T>` envelope and converts HTTP failures into `ApiError`.
 */
@Service()
export class ApiClient {
  private readonly http = inject(HttpClient);
  readonly baseUrl = environment.apiUrl.replace(/\/+$/, '');

  url(path: string): string {
    return `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
  }

  get<T>(path: string, options: RequestOptions = {}): Observable<T> {
    return this.http
      .get<ApiResponse<T>>(this.url(path), this.toHttpOptions(options))
      .pipe(map(unwrap), catchError(toApiError));
  }

  post<T>(path: string, body: unknown = {}, options: RequestOptions = {}): Observable<T> {
    return this.http
      .post<ApiResponse<T>>(this.url(path), body, this.toHttpOptions(options))
      .pipe(map(unwrap), catchError(toApiError));
  }

  put<T>(path: string, body: unknown, options: RequestOptions = {}): Observable<T> {
    return this.http
      .put<ApiResponse<T>>(this.url(path), body, this.toHttpOptions(options))
      .pipe(map(unwrap), catchError(toApiError));
  }

  /** A `204 No Content` answer (no envelope) resolves to `undefined`. */
  delete<T = void>(path: string, options: RequestOptions = {}): Observable<T> {
    return this.http
      .delete<ApiResponse<T> | null>(this.url(path), this.toHttpOptions(options))
      .pipe(
        map((response) => (response === null ? (undefined as T) : unwrap(response))),
        catchError(toApiError)
      );
  }

  private toHttpOptions(options: RequestOptions): { params?: HttpParams; withCredentials?: boolean } {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(options.params ?? {})) {
      if (Array.isArray(value)) {
        for (const item of value) {
          params = params.append(key, item);
        }
      } else if (value !== null && value !== undefined) {
        params = params.set(key, String(value));
      }
    }
    return { params, withCredentials: options.withCredentials };
  }
}

/** User-facing message for a failed API call (`ApiError`), with a fallback for anything else. */
export function apiErrorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (error instanceof ApiError) {
    if (error.status === 0) {
      return 'Cannot reach the server. Check your connection and try again.';
    }
    return error.message || fallback;
  }
  return fallback;
}

/**
 * `httpResource` parser for the API envelope: returns `data`, and throws an `ApiError` (so the
 * resource enters its error state) for `success: false` or a body that is not an envelope, instead
 * of silently turning a failure into an empty value.
 */
export function parseEnvelope<T>(raw: unknown): T {
  const body = raw as Partial<ApiResponse<T>> | null;
  if (!body || typeof body !== 'object' || typeof body.success !== 'boolean') {
    throw new ApiError(200, 'Unexpected response from the server', raw);
  }
  return unwrap(body as ApiResponse<T>);
}

export function unwrap<T>(response: ApiResponse<T>): T {
  if (!response.success) {
    throw new ApiError(200, response.error ?? 'Request failed');
  }
  return response.data as T;
}

export function toApiError(error: unknown): Observable<never> {
  if (error instanceof ApiError) {
    return throwError(() => error);
  }
  if (error instanceof HttpErrorResponse) {
    const body = error.error as Partial<ApiResponse<unknown>> | string | null;
    const message =
      typeof body === 'object' && body !== null && typeof body.error === 'string'
        ? body.error
        : error.status === 0
          ? 'Network error: the API is unreachable'
          : error.message;
    return throwError(() => new ApiError(error.status, message, error));
  }
  return throwError(() => new ApiError(0, error instanceof Error ? error.message : 'Unknown error', error));
}
