import { HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ApiError, apiErrorMessage, toApiError, unwrap } from '@app/core/api/api-client';
import { fail } from '../../test-utils';

describe('API error messages (US-13 error codes)', () => {
  let error: unknown;

  it.each<[string, string]>([
    ['INVALID_CREDENTIALS', 'Invalid email or password.'],
    ['TASK_ALREADY_CLAIMED', 'Someone else has already claimed this task.'],
    ['RATE_LIMITED', 'Too many attempts. Please wait a moment and try again.']
  ])('shows the text for the code %s, not the server wording', (code, text) => {
    givenTheServerRefused({ status: 400, message: 'server wording', code });

    thenTheReaderSees(text);
  });

  it('says how long to wait when a limit answers with Retry-After', () => {
    givenTheServerRefused({ status: 429, message: 'server wording', code: 'RATE_LIMITED', retryAfterSeconds: 7 });

    thenTheReaderSees('Please wait 7 s and try again.');
  });

  it('reads Retry-After from a 429 answer', async () => {
    await whenTheHttpCallFailsWith(429, fail('Please wait 7 seconds before commenting again', 'RATE_LIMITED'), { 'Retry-After': '7' });

    thenTheReaderSees('Please wait 7 s and try again.');
  });

  it('falls back to the server message for a code without its own text', () => {
    givenTheServerRefused({ status: 400, message: 'Display name cannot exceed 100 characters', code: 'VALIDATION_FAILED' });

    thenTheReaderSees('Display name cannot exceed 100 characters');
  });

  it('explains a network failure and anything that is not an API error', () => {
    givenTheServerRefused({ status: 0, message: 'Network error: the API is unreachable', code: null });

    thenTheReaderSees('Cannot reach the server. Check your connection and try again.');

    givenSomethingElseFailed();

    thenTheReaderSees('Something went wrong. Please try again.');
  });

  it('reads the code from an HTTP error body and from a failed envelope', async () => {
    await whenTheHttpCallFailsWith(401, fail('Invalid email or password', 'INVALID_CREDENTIALS'));

    thenTheErrorCodeIs('INVALID_CREDENTIALS');

    whenTheEnvelopeSaysFailure(fail('Task is already claimed by u-2', 'TASK_ALREADY_CLAIMED'));

    thenTheErrorCodeIs('TASK_ALREADY_CLAIMED');
  });

  function givenTheServerRefused(refusal: { status: number; message: string; code: string | null; retryAfterSeconds?: number }): void {
    error = new ApiError(refusal.status, refusal.message, undefined, refusal.code, refusal.retryAfterSeconds ?? null);
  }

  function givenSomethingElseFailed(): void {
    error = new TypeError('boom');
  }

  async function whenTheHttpCallFailsWith(status: number, body: unknown, headers: Record<string, string> = {}): Promise<void> {
    error = await firstValueFrom(toApiError(new HttpErrorResponse({ status, error: body, headers: new HttpHeaders(headers) }))).catch((e: unknown) => e);
  }

  function whenTheEnvelopeSaysFailure(body: ReturnType<typeof fail>): void {
    try {
      unwrap(body);
    } catch (e) {
      error = e;
    }
  }

  function thenTheReaderSees(text: string): void {
    expect(apiErrorMessage(error)).toBe(text);
  }

  function thenTheErrorCodeIs(code: string): void {
    expect((error as ApiError).code).toBe(code);
  }
});
