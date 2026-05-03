import { readString } from '../reader/index.js';
import type { RuntimeEvent } from '../../../../ports/index.js';
import { readCodexThreadItem } from '../reader/index.js';
import type { DecodeCodexNotificationInput } from './codex-notification-input.js';

export function decodeItemEvent(input: DecodeCodexNotificationInput): RuntimeEvent | null {
  const params = input.params;

  switch (input.method) {
    case 'item/started':
      return {
        kind: 'runtime-item-started',
        threadId: readString(params.threadId, 'Codex item/started threadId'),
        turnId: readString(params.turnId, 'Codex item/started turnId'),
        item: readCodexThreadItem(params.item, 'Codex item/started item'),
      };

    case 'item/completed':
      return {
        kind: 'runtime-item-completed',
        threadId: readString(params.threadId, 'Codex item/completed threadId'),
        turnId: readString(params.turnId, 'Codex item/completed turnId'),
        item: readCodexThreadItem(params.item, 'Codex item/completed item'),
      };

    default:
      return null;
  }
}
