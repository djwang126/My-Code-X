import type { JsonValue } from '@my-code-x/contracts-new/json';
import type { RuntimeCommand } from '../../../../ports/index.js';

export interface DecodeCodexResultInput {
  readonly command: RuntimeCommand;
  readonly result: JsonValue;
}
