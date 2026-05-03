import type { JsonObject } from '@my-code-x/contracts-new/json';

export interface RuntimeHostRequest {
  readonly requestId: string;
  readonly threadId?: string | null;
  readonly turnId?: string | null;
  readonly itemId?: string | null;
  readonly data?: JsonObject;
}
