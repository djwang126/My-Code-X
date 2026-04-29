import type { JsonValue } from '../shared/index.js';

export type RuntimeSandboxMode = 'read-only' | 'workspace-write' | 'danger-full-access';

export interface RuntimeSettings {
  readonly model: string | null;
  readonly reasoningEffort: string | null;
  readonly approvalPolicy: string | null;
  readonly sandboxMode: RuntimeSandboxMode | null;
  readonly promptOverride: string | null;
}

export type RuntimeContentItem = RuntimeTextContentItem | RuntimeImageContentItem;

export interface RuntimeTextContentItem {
  readonly kind: 'text';
  readonly text: string;
}

export interface RuntimeImageContentItem {
  readonly kind: 'image';
  readonly imagePath: string;
}

export type RuntimeCommand =
  | StartRuntimeThreadCommand
  | ResumeRuntimeThreadCommand
  | ListRuntimeThreadsCommand
  | StartRuntimeTurnCommand
  | InterruptRuntimeTurnCommand
  | RespondToRuntimeRequestCommand;

export interface StartRuntimeThreadCommand {
  readonly kind: 'start-thread';
  readonly workspace: string;
  readonly runtimeSettings: RuntimeSettings | null;
  readonly baseInstructions: string | null;
}

export interface ResumeRuntimeThreadCommand {
  readonly kind: 'resume-thread';
  readonly threadId: string;
  readonly workspace: string;
  readonly runtimeSettings: RuntimeSettings | null;
  readonly baseInstructions: string | null;
}

export interface ListRuntimeThreadsCommand {
  readonly kind: 'list-threads';
  readonly workspace: string;
  readonly limit: number;
  readonly archived: boolean;
}

export interface StartRuntimeTurnCommand {
  readonly kind: 'start-turn';
  readonly threadId: string;
  readonly message: string;
  readonly content: readonly RuntimeContentItem[];
  readonly runtimeSettings: RuntimeSettings | null;
}

export interface InterruptRuntimeTurnCommand {
  readonly kind: 'interrupt-turn';
  readonly threadId: string;
  readonly turnId: string | null;
}

export interface RespondToRuntimeRequestCommand {
  readonly kind: 'respond-to-runtime-request';
  readonly requestId: string;
  readonly response: JsonValue;
}

export type RuntimeEvent =
  | RuntimeInputRequestedEvent
  | RuntimeTurnStartedEvent
  | RuntimeOutputUpdatedEvent
  | RuntimeTurnCompletedEvent
  | RuntimeSystemNoticeEvent
  | RuntimeErrorEvent;

export type RuntimeInputKind = 'approval' | 'tool-response' | 'unknown';

export interface RuntimeInputRequestedEvent {
  readonly kind: 'runtime-input-requested';
  readonly requestId: string;
  readonly threadId: string | null;
  readonly inputKind: RuntimeInputKind;
  readonly title: string;
  readonly prompt: string;
}

export interface RuntimeTurnStartedEvent {
  readonly kind: 'runtime-turn-started';
  readonly threadId: string;
  readonly turnId: string;
}

export type RuntimeOutputKind = 'text-delta' | 'item-started' | 'item-updated' | 'item-completed';

export interface RuntimeOutputUpdatedEvent {
  readonly kind: 'runtime-output-updated';
  readonly threadId: string;
  readonly turnId: string | null;
  readonly itemId: string;
  readonly outputKind: RuntimeOutputKind;
  readonly text: string | null;
}

export type RuntimeTerminalTurnStatus = 'completed' | 'interrupted' | 'failed';

export interface RuntimeTurnCompletedEvent {
  readonly kind: 'runtime-turn-completed';
  readonly threadId: string;
  readonly turnId: string;
  readonly status: RuntimeTerminalTurnStatus;
  readonly error: RuntimeErrorInfo | null;
}

export interface RuntimeSystemNoticeEvent {
  readonly kind: 'runtime-system-notice';
  readonly threadId: string | null;
  readonly level: 'info' | 'warning' | 'error';
  readonly message: string;
}

export interface RuntimeErrorEvent {
  readonly kind: 'runtime-error';
  readonly threadId: string | null;
  readonly turnId: string | null;
  readonly error: RuntimeErrorInfo;
}

export interface RuntimeErrorInfo {
  readonly message: string;
  readonly code: string | null;
}

export type RuntimeResult =
  | RuntimeOkResult
  | RuntimeThreadStartedResult
  | RuntimeThreadResumedResult
  | RuntimeThreadsListedResult
  | RuntimeTurnStartedResult
  | RuntimeRequestRespondedResult;

export interface RuntimeOkResult {
  readonly kind: 'ok';
}

export interface RuntimeThreadStartedResult {
  readonly kind: 'thread-started';
  readonly threadId: string;
}

export interface RuntimeThreadResumedResult {
  readonly kind: 'thread-resumed';
  readonly threadId: string;
  readonly snapshot: RuntimeThreadSnapshot;
}

export interface RuntimeThreadsListedResult {
  readonly kind: 'threads-listed';
  readonly threads: readonly RuntimeThread[];
}

export interface RuntimeTurnStartedResult {
  readonly kind: 'turn-started';
  readonly turnId: string;
}

export interface RuntimeRequestRespondedResult {
  readonly kind: 'runtime-request-responded';
  readonly requestId: string;
}

export interface RuntimeThread {
  readonly threadId: string;
  readonly title: string | null;
  readonly workspace: string | null;
  readonly updatedAt: string | null;
}

export interface RuntimeThreadSnapshot {
  readonly threadId: string;
  readonly title: string | null;
  readonly items: readonly RuntimeTimelineItem[];
  readonly pendingInputs: readonly RuntimePendingInput[];
}

export interface RuntimeTimelineItem {
  readonly itemId: string;
  readonly itemKind: string;
  readonly status: string | null;
  readonly text: string | null;
}

export interface RuntimePendingInput {
  readonly requestId: string;
  readonly inputKind: RuntimeInputKind;
  readonly prompt: string;
}

export type RuntimeEventHandler = (event: RuntimeEvent) => void;
export type Unsubscribe = () => void;

export interface RuntimePort {
  send(input: RuntimeCommand): Promise<RuntimeResult>;
  subscribe(handler: RuntimeEventHandler): Unsubscribe;
  close(): Promise<void>;
}
