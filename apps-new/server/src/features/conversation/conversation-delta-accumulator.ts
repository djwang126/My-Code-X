import type { JsonObject, JsonValue, RuntimeItemDeltaKind } from '../../ports/index.js';
import type { ConversationItem } from './conversation-events.js';
import {
  mapRuntimeDeltaKindToConversationCodexType,
  readConversationItemCodexType,
  type ConversationDeltaCodexType,
} from './conversation-item-kind-policy.js';

export interface ConversationDeltaAccumulator {
  record(input: RecordConversationDeltaInput): ConversationDeltaProjectionState;
  discardItem(input: DiscardConversationDeltaItemInput): void;
  discardThread(input: DiscardConversationDeltaThreadInput): void;
}

export interface RecordConversationDeltaInput {
  readonly threadId: string;
  readonly itemId: string;
  readonly deltaKind: RuntimeItemDeltaKind;
  readonly text: string | null;
  readonly data: JsonObject | null;
  readonly currentItem: ConversationItem | null;
}

export type ConversationDeltaProjectionState =
  | AgentMessageDeltaState
  | PlanDeltaState
  | ReasoningDeltaState
  | CommandExecutionDeltaState
  | FileChangeDeltaState
  | McpToolCallDeltaState;

export interface ConversationDeltaProjectionStateBase {
  readonly itemId: string;
  readonly kind: ConversationDeltaCodexType;
}

export interface AgentMessageDeltaState extends ConversationDeltaProjectionStateBase {
  readonly kind: 'agentMessage';
  readonly text: string;
}

export interface PlanDeltaState extends ConversationDeltaProjectionStateBase {
  readonly kind: 'plan';
  readonly text: string;
}

export interface ReasoningDeltaState extends ConversationDeltaProjectionStateBase {
  readonly kind: 'reasoning';
  readonly summary: readonly string[];
  readonly content: readonly string[];
}

export interface CommandExecutionDeltaState extends ConversationDeltaProjectionStateBase {
  readonly kind: 'commandExecution';
  readonly aggregatedOutput: string;
  readonly terminalInput: string;
}

export interface FileChangeDeltaState extends ConversationDeltaProjectionStateBase {
  readonly kind: 'fileChange';
  readonly output: string;
  readonly changes: readonly JsonValue[];
}

export interface McpToolCallDeltaState extends ConversationDeltaProjectionStateBase {
  readonly kind: 'mcpToolCall';
  readonly progressMessages: readonly string[];
}

export interface DiscardConversationDeltaItemInput {
  readonly threadId: string;
  readonly itemId: string;
}

export interface DiscardConversationDeltaThreadInput {
  readonly threadId: string;
}

export class ConversationDeltaKindConflictError extends Error {
  constructor(
    public readonly itemId: string,
    public readonly existingKind: string,
    public readonly deltaKind: RuntimeItemDeltaKind,
  ) {
    super(`Conflicting runtime delta kinds for conversation item ${itemId}`);
    this.name = 'ConversationDeltaKindConflictError';
  }
}

export class ConversationDeltaFieldError extends Error {
  constructor(
    public readonly itemId: string,
    public readonly deltaKind: RuntimeItemDeltaKind,
    public readonly fieldName: string,
  ) {
    super(`Runtime delta ${deltaKind} for conversation item ${itemId} is missing ${fieldName}`);
    this.name = 'ConversationDeltaFieldError';
  }
}

export function createConversationDeltaAccumulator(): ConversationDeltaAccumulator {
  const pendingDeltas = new Map<string, ConversationDeltaProjectionState>();

  return {
    record(input: RecordConversationDeltaInput): ConversationDeltaProjectionState {
      const key = createDeltaKey(input);
      const current = pendingDeltas.get(key) ?? createInitialDeltaState(input);
      const next = applyDeltaToState({
        state: current,
        input,
      });

      pendingDeltas.set(key, next);
      return next;
    },

    discardItem(input: DiscardConversationDeltaItemInput): void {
      pendingDeltas.delete(createDeltaKey(input));
    },

    discardThread(input: DiscardConversationDeltaThreadInput): void {
      const prefix = `${input.threadId}\u0000`;

      for (const key of pendingDeltas.keys()) {
        if (key.startsWith(prefix)) {
          pendingDeltas.delete(key);
        }
      }
    },
  };
}

interface ApplyDeltaToStateInput {
  readonly state: ConversationDeltaProjectionState;
  readonly input: RecordConversationDeltaInput;
}

function applyDeltaToState(input: ApplyDeltaToStateInput): ConversationDeltaProjectionState {
  assertDeltaMatchesStateKind({
    itemId: input.input.itemId,
    stateKind: input.state.kind,
    deltaKind: input.input.deltaKind,
  });

  switch (input.input.deltaKind) {
    case 'agent-message':
      return {
        itemId: input.state.itemId,
        kind: 'agentMessage',
        text: `${(input.state as AgentMessageDeltaState).text}${input.input.text ?? ''}`,
      };

    case 'plan':
      return {
        itemId: input.state.itemId,
        kind: 'plan',
        text: `${(input.state as PlanDeltaState).text}${input.input.text ?? ''}`,
      };

    case 'reasoning-summary-text': {
      const state = input.state as ReasoningDeltaState;
      const summaryIndex = readRequiredIndex({
        itemId: input.input.itemId,
        deltaKind: input.input.deltaKind,
        data: input.input.data,
        fieldName: 'summaryIndex',
      });

      return {
        ...state,
        summary: appendIndexedText({
          values: state.summary,
          index: summaryIndex,
          text: input.input.text ?? '',
        }),
      };
    }

    case 'reasoning-summary-part': {
      const state = input.state as ReasoningDeltaState;
      const summaryIndex = readRequiredIndex({
        itemId: input.input.itemId,
        deltaKind: input.input.deltaKind,
        data: input.input.data,
        fieldName: 'summaryIndex',
      });

      return {
        ...state,
        summary: ensureIndex({
          values: state.summary,
          index: summaryIndex,
        }),
      };
    }

    case 'reasoning-text': {
      const state = input.state as ReasoningDeltaState;
      const contentIndex = readRequiredIndex({
        itemId: input.input.itemId,
        deltaKind: input.input.deltaKind,
        data: input.input.data,
        fieldName: 'contentIndex',
      });

      return {
        ...state,
        content: appendIndexedText({
          values: state.content,
          index: contentIndex,
          text: input.input.text ?? '',
        }),
      };
    }

    case 'command-output':
      return {
        ...(input.state as CommandExecutionDeltaState),
        aggregatedOutput: `${(input.state as CommandExecutionDeltaState).aggregatedOutput}${input.input.text ?? ''}`,
      };

    case 'terminal-interaction':
      return {
        ...(input.state as CommandExecutionDeltaState),
        terminalInput: `${(input.state as CommandExecutionDeltaState).terminalInput}${input.input.text ?? ''}`,
      };

    case 'file-change-output':
      return {
        ...(input.state as FileChangeDeltaState),
        output: `${(input.state as FileChangeDeltaState).output}${input.input.text ?? ''}`,
      };

    case 'file-change-patch':
      return {
        ...(input.state as FileChangeDeltaState),
        changes: readJsonArrayField({
          data: input.input.data,
          fieldName: 'changes',
        }),
      };

    case 'mcp-tool-progress':
      return {
        ...(input.state as McpToolCallDeltaState),
        progressMessages: [
          ...(input.state as McpToolCallDeltaState).progressMessages,
          input.input.text ?? '',
        ].filter(message => message.length > 0),
      };
  }
}

function createInitialDeltaState(input: RecordConversationDeltaInput): ConversationDeltaProjectionState {
  assertCurrentItemMatchesDeltaKind(input);

  const kind = mapRuntimeDeltaKindToConversationCodexType(input.deltaKind);

  switch (kind) {
    case 'agentMessage':
      return {
        itemId: input.itemId,
        kind,
        text: input.currentItem?.kind === 'message' ? input.currentItem.text : '',
      };

    case 'plan':
      return {
        itemId: input.itemId,
        kind,
        text: readStringField(input.currentItem, 'text'),
      };

    case 'reasoning':
      return {
        itemId: input.itemId,
        kind,
        summary: readStringArrayField(input.currentItem, 'summary'),
        content: readStringArrayField(input.currentItem, 'content'),
      };

    case 'commandExecution':
      return {
        itemId: input.itemId,
        kind,
        aggregatedOutput: readStringField(input.currentItem, 'aggregatedOutput'),
        terminalInput: readStringField(input.currentItem, 'terminalInput'),
      };

    case 'fileChange':
      return {
        itemId: input.itemId,
        kind,
        output: readStringField(input.currentItem, 'output'),
        changes: readJsonArrayItemField(input.currentItem, 'changes'),
      };

    case 'mcpToolCall':
      return {
        itemId: input.itemId,
        kind,
        progressMessages: readStringArrayField(input.currentItem, 'progressMessages'),
      };
  }
}


function assertCurrentItemMatchesDeltaKind(input: RecordConversationDeltaInput): void {
  if (!input.currentItem) {
    return;
  }

  const expectedKind = mapRuntimeDeltaKindToConversationCodexType(input.deltaKind);
  const existingKind = readConversationItemCodexType(input.currentItem);

  if (existingKind === expectedKind) {
    return;
  }

  throw new ConversationDeltaKindConflictError(input.itemId, existingKind, input.deltaKind);
}

interface AssertDeltaMatchesStateKindInput {
  readonly itemId: string;
  readonly stateKind: ConversationDeltaCodexType;
  readonly deltaKind: RuntimeItemDeltaKind;
}

function assertDeltaMatchesStateKind(input: AssertDeltaMatchesStateKindInput): void {
  const expectedKind = mapRuntimeDeltaKindToConversationCodexType(input.deltaKind);

  if (expectedKind !== input.stateKind) {
    throw new ConversationDeltaKindConflictError(input.itemId, input.stateKind, input.deltaKind);
  }
}

interface AppendIndexedTextInput {
  readonly values: readonly string[];
  readonly index: number;
  readonly text: string;
}

function appendIndexedText(input: AppendIndexedTextInput): readonly string[] {
  const output = ensureIndex({
    values: input.values,
    index: input.index,
  });

  return output.map((value, index) => (index === input.index ? `${value}${input.text}` : value));
}

interface EnsureIndexInput {
  readonly values: readonly string[];
  readonly index: number;
}

function ensureIndex(input: EnsureIndexInput): readonly string[] {
  if (input.values.length > input.index) {
    return input.values;
  }

  return [
    ...input.values,
    ...Array.from({ length: input.index - input.values.length + 1 }, () => ''),
  ];
}

interface ReadRequiredIndexInput {
  readonly itemId: string;
  readonly deltaKind: RuntimeItemDeltaKind;
  readonly data: JsonObject | null;
  readonly fieldName: string;
}

function readRequiredIndex(input: ReadRequiredIndexInput): number {
  const value = input.data?.[input.fieldName];

  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) {
    return value;
  }

  throw new ConversationDeltaFieldError(input.itemId, input.deltaKind, input.fieldName);
}

interface ReadJsonArrayFieldInput {
  readonly data: JsonObject | null;
  readonly fieldName: string;
}

function readJsonArrayField(input: ReadJsonArrayFieldInput): readonly JsonValue[] {
  const value = input.data?.[input.fieldName];

  if (Array.isArray(value)) {
    return value;
  }

  return [];
}

function readStringField(item: ConversationItem | null, fieldName: string): string {
  const value = readItemFieldValue(item, fieldName);
  return typeof value === 'string' ? value : '';
}

function readStringArrayField(item: ConversationItem | null, fieldName: string): readonly string[] {
  const value = readItemFieldValue(item, fieldName);

  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === 'string');
}

function readJsonArrayItemField(item: ConversationItem | null, fieldName: string): readonly JsonValue[] {
  const value = readItemFieldValue(item, fieldName);
  return Array.isArray(value) ? value : [];
}

function readItemFieldValue(item: ConversationItem | null, fieldName: string): JsonValue | undefined {
  if (item?.kind !== 'work-trace') {
    return undefined;
  }

  return item.fields.find(field => field.name === fieldName)?.value;
}

interface CreateDeltaKeyInput {
  readonly threadId: string;
  readonly itemId: string;
}

function createDeltaKey(input: CreateDeltaKeyInput): string {
  return `${input.threadId}\u0000${input.itemId}`;
}
