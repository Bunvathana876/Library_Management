import { describe, expect, it } from 'vitest';
import { ApiError, formatApiErrorMessage, parseProblemDetail } from '@/utils/errors';

describe('errors utilities', () => {
  it('parses RFC 7807 ProblemDetail with validation field errors', () => {
    const err = parseProblemDetail(400, {
      title: 'Bad Request',
      status: 400,
      detail: 'Request validation failed',
      errors: {
        title: 'Title is required',
        publicationYear: 'Publication year must be positive',
      },
    });

    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(400);
    expect(err.detail).toBe('Request validation failed');
    expect(err.fieldErrors.title).toBe('Title is required');
    expect(err.fieldErrors.publicationYear).toBe('Publication year must be positive');
  });

  it('explains book deletion FK constraint 409 conflicts clearly', () => {
    const err = new ApiError(409, 'This operation violates a database constraint');
    expect(formatApiErrorMessage(err, 'deleteBook')).toContain('existing loan history');
    expect(formatApiErrorMessage(err)).toBe('This operation violates a database constraint');
  });

  it('provides actionable message when backend network fetch fails', () => {
    const err = new TypeError('Failed to fetch');
    expect(formatApiErrorMessage(err)).toContain('port 8080');
  });
});
