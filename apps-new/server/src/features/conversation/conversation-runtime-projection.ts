import type { RuntimeThreadItem } from '../../ports/index.js';
import type { ConversationItem, ConversationMessageRole } from './conversation-events.js';

export interface ProjectRuntimeThreadItemInput {
  readonly item: RuntimeThreadItem;
}

export function projectRuntimeThreadItem(input: ProjectRuntimeThreadItemInput): ConversationItem | null {
  const role = mapRuntimeThreadItemRole(input.item);

  if (!role || input.item.text === null) {
    return null;
  }

  return {
    id: input.item.itemId,
    kind: 'message',
    role,
    text: input.item.text,
  };
}

function mapRuntimeThreadItemRole(item: RuntimeThreadItem): ConversationMessageRole | null {
  switch (item.itemKind) {
    case 'userMessage':
      return 'user';

    case 'agentMessage':
      return 'assistant';

    default:
      return null;
  }
}
