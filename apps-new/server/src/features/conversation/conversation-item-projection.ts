import type {
  RuntimeFallbackThreadItem,
  RuntimeTimelineItem,
  RuntimeThreadItem,
  RuntimeTurn,
} from '../../ports/index.js';
import type {
  ConversationItem,
  ConversationMessageItem,
  ConversationUnknownItem,
  ConversationWorkTraceItem,
} from './conversation-events.js';
import { createConversationErrorItemId, projectRuntimeError } from './conversation-error-projection.js';
import { projectConversationItemFields } from './conversation-field-projection.js';
import { isRuntimeWorkTraceItemKind, readRuntimeMessageRole } from './conversation-item-kind-policy.js';

export interface ProjectRuntimeThreadItemInput {
  readonly item: RuntimeThreadItem;
}

export function projectRuntimeThreadItem(input: ProjectRuntimeThreadItemInput): ConversationItem | null {
  const message = projectRuntimeMessageItem({ item: input.item });

  if (message) {
    return message;
  }

  if (input.item.itemKind === 'unknown') {
    return projectRuntimeUnknownItem({ item: input.item });
  }

  if (isRuntimeWorkTraceItemKind(input.item.itemKind)) {
    return projectRuntimeWorkTraceItem({ item: input.item });
  }

  return null;
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

export interface ProjectRuntimeTurnsInput {
  readonly turns: readonly RuntimeTurn[];
}

export function projectRuntimeTurns(input: ProjectRuntimeTurnsInput): readonly ConversationItem[] {
  const items: ConversationItem[] = [];

  for (const turn of input.turns) {
    items.push(...projectRuntimeTimeline({ items: turn.items }));

    if (turn.status === 'failed' && turn.error) {
      items.push(projectRuntimeError({
        turnId: turn.id,
        error: turn.error,
      }));
    }
  }

  return items;
}

export interface CreateRuntimeTurnConversationOrderInput {
  readonly turns: readonly RuntimeTurn[] | null;
}

export function createRuntimeTurnConversationOrder(input: CreateRuntimeTurnConversationOrderInput): readonly string[] {
  if (!input.turns) {
    return [];
  }

  return input.turns.flatMap(turn => {
    const itemIds = turn.items.map(item => item.itemId);

    if (turn.status === 'failed' && turn.error) {
      return [
        ...itemIds,
        createConversationErrorItemId({ turnId: turn.id }),
      ];
    }

    return itemIds;
  });
}

interface ProjectRuntimeMessageItemInput {
  readonly item: RuntimeThreadItem;
}

function projectRuntimeMessageItem(input: ProjectRuntimeMessageItemInput): ConversationMessageItem | null {
  const role = readRuntimeMessageRole(input.item);

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

interface ProjectRuntimeWorkTraceItemInput {
  readonly item: RuntimeThreadItem;
}

function projectRuntimeWorkTraceItem(input: ProjectRuntimeWorkTraceItemInput): ConversationWorkTraceItem {
  return {
    id: input.item.itemId,
    kind: 'work-trace',
    codexType: input.item.itemKind,
    fields: projectConversationItemFields({ raw: input.item.raw }),
  };
}

interface ProjectRuntimeUnknownItemInput {
  readonly item: RuntimeFallbackThreadItem;
}

function projectRuntimeUnknownItem(input: ProjectRuntimeUnknownItemInput): ConversationUnknownItem {
  return {
    id: input.item.itemId,
    kind: 'unknown',
    codexType: input.item.unknownItemKind || 'unknown',
    fields: projectConversationItemFields({ raw: input.item.raw }),
  };
}
