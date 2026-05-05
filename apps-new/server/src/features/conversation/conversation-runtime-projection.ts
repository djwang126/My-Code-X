import type {
  RuntimeErrorInfo,
  RuntimeFallbackThreadItem,
  RuntimeTimelineItem,
  RuntimeThreadItem,
  RuntimeTurn,
} from '../../ports/index.js';
import type {
  ConversationErrorItem,
  ConversationItem,
  ConversationItemField,
  ConversationMessageItem,
  ConversationMessageRole,
  ConversationUnknownItem,
  ConversationWorkTraceItem,
} from './conversation-events.js';

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

  if (isWorkTraceItemKind(input.item.itemKind)) {
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

export interface ProjectRuntimeErrorInput {
  readonly turnId: string;
  readonly error: RuntimeErrorInfo;
}

export function projectRuntimeError(input: ProjectRuntimeErrorInput): ConversationErrorItem {
  return {
    id: `error:${input.turnId}`,
    kind: 'error',
    message: input.error.message,
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

interface ProjectRuntimeMessageItemInput {
  readonly item: RuntimeThreadItem;
}

function projectRuntimeMessageItem(input: ProjectRuntimeMessageItemInput): ConversationMessageItem | null {
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

interface ProjectRuntimeWorkTraceItemInput {
  readonly item: RuntimeThreadItem;
}

function projectRuntimeWorkTraceItem(input: ProjectRuntimeWorkTraceItemInput): ConversationWorkTraceItem {
  return {
    id: input.item.itemId,
    kind: 'work-trace',
    codexType: input.item.itemKind,
    fields: createConversationItemFields({ raw: input.item.raw }),
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
    fields: createConversationItemFields({ raw: input.item.raw }),
  };
}

interface CreateConversationItemFieldsInput {
  readonly raw: RuntimeThreadItem['raw'];
}

function createConversationItemFields(input: CreateConversationItemFieldsInput): readonly ConversationItemField[] {
  const fields: ConversationItemField[] = [];

  if (input.raw) {
    for (const [name, value] of Object.entries(input.raw)) {
      fields.push({
        name,
        value,
      });
    }
  }

  return fields;
}

const workTraceItemKinds = new Set<string>([
  'hookPrompt',
  'plan',
  'reasoning',
  'commandExecution',
  'fileChange',
  'mcpToolCall',
  'dynamicToolCall',
  'collabAgentToolCall',
  'webSearch',
  'imageView',
  'imageGeneration',
  'enteredReviewMode',
  'exitedReviewMode',
  'contextCompaction',
]);

function isWorkTraceItemKind(itemKind: string): boolean {
  return workTraceItemKinds.has(itemKind);
}
