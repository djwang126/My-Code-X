import type { RuntimeTimelineItem, RuntimeThreadItem } from '../../ports/index.js';
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

export interface ProjectRuntimeTimelineInput {
  readonly items: readonly RuntimeTimelineItem[];
}

export function projectRuntimeTimeline(input: ProjectRuntimeTimelineInput): readonly ConversationItem[] {
  const items: ConversationItem[] = [];

  for (const item of input.items) {
    const projected = projectRuntimeThreadItem({ item });

    if (projected) {
      items.push(projected);
    }
  }

  return items;
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
