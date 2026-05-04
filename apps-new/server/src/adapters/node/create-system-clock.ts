import type { ClockPort } from '../../ports/index.js';

export function createSystemClock(): ClockPort {
  return {
    now() {
      return new Date().toISOString();
    },
  };
}
