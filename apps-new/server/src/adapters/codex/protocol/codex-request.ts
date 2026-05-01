import type { JsonObject } from '@my-code-x/contracts-new/json';

export interface CodexRequest {
  readonly method: string;
  readonly params: JsonObject;
}

export interface CodexNotification {
  readonly method: string;
  readonly params: JsonObject | null;
}
