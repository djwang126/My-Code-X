import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { createHttpErrorResponse } from './http-error-response.js';
import { BoundaryError, SkeletonMigrationPendingError } from '../shared/index.js';

describe('createHttpErrorResponse', () => {
  test('preserves known boundary error messages', () => {
    assert.deepEqual(createHttpErrorResponse(new BoundaryError('Bad client input')), {
      kind: 'json',
      statusCode: 400,
      headers: {},
      body: {
        error: {
          message: 'Bad client input',
        },
      },
    });
  });

  test('preserves skeleton migration errors as not implemented responses', () => {
    assert.deepEqual(createHttpErrorResponse(new SkeletonMigrationPendingError('sendClientMessage')), {
      kind: 'json',
      statusCode: 501,
      headers: {},
      body: {
        error: {
          message: 'sendClientMessage is a skeleton boundary. Migrate the real feature behavior before using it.',
        },
      },
    });
  });

  test('does not expose unexpected internal error messages', () => {
    assert.deepEqual(createHttpErrorResponse(new Error('database password leaked')), {
      kind: 'json',
      statusCode: 500,
      headers: {},
      body: {
        error: {
          message: 'Internal server error',
        },
      },
    });
  });
});
