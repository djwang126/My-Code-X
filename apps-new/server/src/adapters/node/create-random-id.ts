import { randomUUID } from 'node:crypto';
import type { IdPort } from '../../ports/index.js';

export function createRandomId(): IdPort {
  return {
    createId() {
      return randomUUID();
    },
  };
}
