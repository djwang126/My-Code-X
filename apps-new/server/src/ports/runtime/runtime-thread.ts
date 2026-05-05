import type { JsonObject, JsonValue } from '@my-code-x/contracts-new/json';
import type { RuntimeErrorInfo } from './runtime-error.js';
import type { RuntimeHostRequest } from './runtime-host-request.js';

export type RuntimeTerminalTurnStatus = 'completed' | 'interrupted' | 'failed';
export type RuntimeTurnStatus = 'inProgress' | RuntimeTerminalTurnStatus;

export type RuntimeThreadStatus = JsonValue;

export interface RuntimeThread {
  readonly threadId: string;
  readonly name: string | null;
  readonly workspace: string | null;
  readonly updatedAt: string | null;
  readonly id?: string;
  readonly forkedFromId?: string | null;
  readonly preview?: string;
  readonly ephemeral?: boolean;
  readonly modelProvider?: string | null;
  readonly createdAt?: number | null;
  readonly updatedAtUnix?: number | null;
  readonly status?: RuntimeThreadStatus;
  readonly path?: string | null;
  readonly cwd?: string | null;
  readonly cliVersion?: string | null;
  readonly source?: JsonValue;
  readonly agentNickname?: string | null;
  readonly agentRole?: string | null;
  readonly gitInfo?: JsonValue;
  readonly turns?: readonly RuntimeTurn[];
  readonly raw?: JsonObject;
}

export interface RuntimeThreadSnapshot {
  readonly threadId: string;
  readonly name: string | null;
  readonly items: readonly RuntimeTimelineItem[];
  readonly pendingInputs: readonly RuntimeHostRequest[];
  readonly turns?: readonly RuntimeTurn[];
  readonly thread?: RuntimeThread | null;
}

export interface RuntimeTurn {
  readonly id: string;
  readonly items: readonly RuntimeThreadItem[];
  readonly status: RuntimeTurnStatus;
  readonly error: RuntimeErrorInfo | null;
  readonly startedAt: number | null;
  readonly completedAt: number | null;
  readonly durationMs: number | null;
  readonly raw?: JsonObject;
}

export interface RuntimeThreadItemBase {
  readonly itemId: string;
  readonly itemKind: string;
  readonly status: string | null;
  readonly text: string | null;
  readonly raw?: JsonObject;
}

export type RuntimeThreadItem =
  | RuntimeUserMessageThreadItem
  | RuntimeHookPromptThreadItem
  | RuntimeAgentMessageThreadItem
  | RuntimePlanThreadItem
  | RuntimeReasoningThreadItem
  | RuntimeCommandExecutionThreadItem
  | RuntimeFileChangeThreadItem
  | RuntimeMcpToolCallThreadItem
  | RuntimeDynamicToolCallThreadItem
  | RuntimeCollabAgentToolCallThreadItem
  | RuntimeWebSearchThreadItem
  | RuntimeImageViewThreadItem
  | RuntimeImageGenerationThreadItem
  | RuntimeReviewModeThreadItem
  | RuntimeContextCompactionThreadItem
  | RuntimeFallbackThreadItem;

export interface RuntimeUserMessageThreadItem extends RuntimeThreadItemBase {
  readonly itemKind: 'userMessage';
  readonly content: readonly JsonValue[];
}

export interface RuntimeHookPromptThreadItem extends RuntimeThreadItemBase {
  readonly itemKind: 'hookPrompt';
  readonly fragments: readonly JsonValue[];
}

export interface RuntimeAgentMessageThreadItem extends RuntimeThreadItemBase {
  readonly itemKind: 'agentMessage';
  readonly phase: string | null;
  readonly memoryCitation: JsonValue;
}

export interface RuntimePlanThreadItem extends RuntimeThreadItemBase {
  readonly itemKind: 'plan';
}

export interface RuntimeReasoningThreadItem extends RuntimeThreadItemBase {
  readonly itemKind: 'reasoning';
  readonly summary: readonly JsonValue[];
  readonly content: readonly JsonValue[];
}

export interface RuntimeCommandExecutionThreadItem extends RuntimeThreadItemBase {
  readonly itemKind: 'commandExecution';
  readonly command: string | null;
  readonly cwd: string | null;
  readonly processId: string | null;
  readonly source: JsonValue;
  readonly commandActions: readonly JsonValue[];
  readonly aggregatedOutput: string | null;
  readonly exitCode: number | null;
  readonly durationMs: number | null;
}

export interface RuntimeFileChangeThreadItem extends RuntimeThreadItemBase {
  readonly itemKind: 'fileChange';
  readonly changes: readonly JsonValue[];
}

export interface RuntimeMcpToolCallThreadItem extends RuntimeThreadItemBase {
  readonly itemKind: 'mcpToolCall';
  readonly server: string | null;
  readonly tool: string | null;
  readonly arguments: JsonValue;
  readonly result: JsonValue;
  readonly error: JsonValue;
  readonly durationMs: number | null;
}

export interface RuntimeDynamicToolCallThreadItem extends RuntimeThreadItemBase {
  readonly itemKind: 'dynamicToolCall';
  readonly namespace: string | null;
  readonly tool: string | null;
  readonly arguments: JsonValue;
  readonly contentItems: readonly JsonValue[] | null;
  readonly success: boolean | null;
  readonly durationMs: number | null;
}

export interface RuntimeCollabAgentToolCallThreadItem extends RuntimeThreadItemBase {
  readonly itemKind: 'collabAgentToolCall';
  readonly tool: JsonValue;
  readonly senderThreadId: string | null;
  readonly receiverThreadIds: readonly JsonValue[];
  readonly prompt: string | null;
  readonly model: string | null;
  readonly reasoningEffort: string | null;
  readonly agentsStates: JsonValue;
}

export interface RuntimeWebSearchThreadItem extends RuntimeThreadItemBase {
  readonly itemKind: 'webSearch';
  readonly query: string | null;
  readonly action: JsonValue;
}

export interface RuntimeImageViewThreadItem extends RuntimeThreadItemBase {
  readonly itemKind: 'imageView';
  readonly path: string | null;
}

export interface RuntimeImageGenerationThreadItem extends RuntimeThreadItemBase {
  readonly itemKind: 'imageGeneration';
  readonly revisedPrompt: string | null;
  readonly result: string | null;
  readonly savedPath: string | null;
}

export interface RuntimeReviewModeThreadItem extends RuntimeThreadItemBase {
  readonly itemKind: 'enteredReviewMode' | 'exitedReviewMode';
  readonly review: string | null;
}

export interface RuntimeContextCompactionThreadItem extends RuntimeThreadItemBase {
  readonly itemKind: 'contextCompaction';
}

export interface RuntimeFallbackThreadItem extends RuntimeThreadItemBase {
  readonly itemKind: 'unknown';
  readonly unknownItemKind: string;
}

export type RuntimeTimelineItem = RuntimeThreadItem;

