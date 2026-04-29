import type { JsonObject } from '../../../shared/index.js';

export interface CodexRequest {
  readonly method: string;
  readonly params: JsonObject;
}

export interface CodexNotification {
  readonly method: string;
  readonly params: JsonObject | null;
}
