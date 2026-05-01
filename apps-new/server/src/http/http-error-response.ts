import { BoundaryError, SkeletonMigrationPendingError } from '../shared/index.js';
import { errorResponse } from './http-responses.js';
import type { HttpJsonResponse } from './http-types.js';

export function createHttpErrorResponse(error: unknown): HttpJsonResponse {
  if (error instanceof BoundaryError) {
    return errorResponse({
      statusCode: 400,
      body: error.message,
    });
  }

  if (error instanceof SkeletonMigrationPendingError) {
    return errorResponse({
      statusCode: 501,
      body: error.message,
    });
  }

  if (error instanceof Error) {
    return errorResponse({
      statusCode: 500,
      body: 'Internal server error',
    });
  }

  return errorResponse({
    statusCode: 500,
    body: 'Internal server error',
  });
}
