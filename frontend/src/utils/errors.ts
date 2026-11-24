import type { ProblemDetail } from '@/types/api';

export class ApiError extends Error {
  readonly status: number;
  readonly detail: string;
  readonly fieldErrors: Record<string, string>;

  constructor(status: number, detail: string, fieldErrors: Record<string, string> = {}) {
    super(detail);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
    this.fieldErrors = fieldErrors;
  }
}

export function parseProblemDetail(
  status: number,
  body: unknown,
  fallbackMessage = 'Request failed',
): ApiError {
  if (body && typeof body === 'object') {
    const problem = body as ProblemDetail;
    const detail =
      typeof problem.detail === 'string' && problem.detail.trim().length > 0
        ? problem.detail
        : typeof problem.title === 'string' && problem.title.trim().length > 0
          ? problem.title
          : defaultStatusMessage(status, fallbackMessage);

    const fieldErrors: Record<string, string> = {};
    if (problem.errors && typeof problem.errors === 'object') {
      for (const [key, value] of Object.entries(problem.errors)) {
        if (typeof value === 'string') {
          fieldErrors[key] = value;
        }
      }
    }
    return new ApiError(status, detail, fieldErrors);
  }

  return new ApiError(status, defaultStatusMessage(status, fallbackMessage));
}

export function defaultStatusMessage(status: number, fallback = 'Request failed'): string {
  switch (status) {
    case 400:
      return 'Invalid request parameters or validation error.';
    case 401:
      return 'Authentication is required. Please sign in to continue.';
    case 403:
      return 'You do not have permission to perform this action.';
    case 404:
      return 'The requested record could not be found.';
    case 409:
      return 'This action conflicts with existing data.';
    case 502:
    case 503:
    case 504:
      return 'Backend API server is unreachable. Verify Spring Boot is running on port 8080.';
    default:
      return fallback;
  }
}

export function formatApiErrorMessage(err: unknown, context?: 'deleteBook'): string {
  if (err instanceof ApiError) {
    if (
      context === 'deleteBook' &&
      err.status === 409 &&
      err.detail.toLowerCase().includes('database constraint')
    ) {
      return 'This book has existing loan history and cannot be deleted from the database.';
    }
    return err.detail;
  }
  if (err instanceof TypeError) {
    return 'Cannot reach the Spring Boot API server. Make sure the backend is running on port 8080.';
  }
  if (err instanceof Error) {
    return err.message;
  }
  return 'An unexpected error occurred.';
}
