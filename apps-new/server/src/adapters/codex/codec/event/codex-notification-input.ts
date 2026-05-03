import type { JsonObject } from '@my-code-x/contracts-new/json';

export interface DecodeCodexNotificationInput {
  readonly method: string;
  readonly params: JsonObject;
}
