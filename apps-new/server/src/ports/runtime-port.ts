import type { JsonObject, JsonValue } from '../shared/index.js';

export type RuntimeSandboxMode = 'read-only' | 'workspace-write' | 'danger-full-access';

export interface RuntimeSettings {
  readonly model: string | null;
  readonly reasoningEffort: string | null;
  readonly approvalPolicy: string | null;
  readonly sandboxMode: RuntimeSandboxMode | null;
  readonly promptOverride: string | null;
}

export type RuntimeContentItem =
  | RuntimeTextContentItem
  | RuntimeLocalImageContentItem
  | RuntimeRemoteImageContentItem
  | RuntimeSkillContentItem
  | RuntimeMentionContentItem;

export interface RuntimeTextContentItem {
  readonly kind: 'text';
  readonly text: string;
  readonly textElements?: readonly RuntimeTextElement[];
}

export interface RuntimeTextElement {
  readonly byteRange: RuntimeByteRange;
  readonly placeholder: string | null;
}

export interface RuntimeByteRange {
  readonly start: number;
  readonly end: number;
}

export interface RuntimeLocalImageContentItem {
  readonly kind: 'image';
  readonly imagePath: string;
}

export interface RuntimeRemoteImageContentItem {
  readonly kind: 'remote-image';
  readonly imageUrl: string;
}

export interface RuntimeSkillContentItem {
  readonly kind: 'skill';
  readonly name: string;
  readonly path: string;
}

export interface RuntimeMentionContentItem {
  readonly kind: 'mention';
  readonly name: string;
  readonly path: string;
}

export type RuntimeCommand =
  | StartRuntimeThreadCommand
  | ResumeRuntimeThreadCommand
  | ForkRuntimeThreadCommand
  | ArchiveRuntimeThreadCommand
  | UnarchiveRuntimeThreadCommand
  | UnsubscribeRuntimeThreadCommand
  | IncrementRuntimeThreadElicitationCommand
  | DecrementRuntimeThreadElicitationCommand
  | SetRuntimeThreadNameCommand
  | UpdateRuntimeThreadMetadataCommand
  | SetRuntimeThreadMemoryModeCommand
  | CompactRuntimeThreadCommand
  | RunRuntimeThreadShellCommandCommand
  | ApproveRuntimeThreadGuardianDeniedActionCommand
  | CleanRuntimeThreadBackgroundTerminalsCommand
  | InjectRuntimeThreadItemsCommand
  | ReadRuntimeThreadCommand
  | ListRuntimeThreadsCommand
  | ListLoadedRuntimeThreadsCommand
  | ListRuntimeThreadTurnsCommand
  | RollbackRuntimeThreadCommand
  | StartRuntimeTurnCommand
  | SteerRuntimeTurnCommand
  | StartRuntimeReviewCommand
  | InterruptRuntimeTurnCommand
  | RespondToRuntimeRequestCommand;

export interface RuntimeThreadConfigCommandBase {
  readonly workspace: string | null;
  readonly runtimeSettings: RuntimeSettings | null;
  readonly baseInstructions: string | null;
  readonly developerInstructions?: string | null;
  readonly modelProvider?: string | null;
  readonly serviceTier?: JsonValue;
  readonly approvalsReviewer?: JsonValue;
  readonly permissionProfile?: JsonValue;
  readonly personality?: JsonValue;
  readonly config?: JsonObject | null;
}

export interface StartRuntimeThreadCommand extends RuntimeThreadConfigCommandBase {
  readonly kind: 'start-thread';
  readonly workspace: string;
  readonly serviceName?: string | null;
  readonly ephemeral?: boolean | null;
  readonly sessionStartSource?: JsonValue;
  readonly experimentalRawEvents?: boolean | null;
}

export interface ResumeRuntimeThreadCommand extends RuntimeThreadConfigCommandBase {
  readonly kind: 'resume-thread';
  readonly threadId: string;
  readonly workspace: string;
  readonly history?: readonly JsonValue[] | null;
  readonly path?: string | null;
}

export interface ForkRuntimeThreadCommand extends RuntimeThreadConfigCommandBase {
  readonly kind: 'fork-thread';
  readonly threadId: string;
  readonly workspace: string | null;
  readonly path?: string | null;
  readonly ephemeral?: boolean | null;
}

export interface ArchiveRuntimeThreadCommand {
  readonly kind: 'archive-thread';
  readonly threadId: string;
}

export interface UnarchiveRuntimeThreadCommand {
  readonly kind: 'unarchive-thread';
  readonly threadId: string;
}

export interface UnsubscribeRuntimeThreadCommand {
  readonly kind: 'unsubscribe-thread';
  readonly threadId: string;
}

export interface IncrementRuntimeThreadElicitationCommand {
  readonly kind: 'increment-thread-elicitation';
  readonly threadId: string;
}

export interface DecrementRuntimeThreadElicitationCommand {
  readonly kind: 'decrement-thread-elicitation';
  readonly threadId: string;
}

export interface SetRuntimeThreadNameCommand {
  readonly kind: 'set-thread-name';
  readonly threadId: string;
  readonly name: string;
}

export interface UpdateRuntimeThreadMetadataCommand {
  readonly kind: 'update-thread-metadata';
  readonly threadId: string;
  readonly gitInfo?: JsonValue;
}

export type RuntimeThreadMemoryMode = 'enabled' | 'disabled';

export interface SetRuntimeThreadMemoryModeCommand {
  readonly kind: 'set-thread-memory-mode';
  readonly threadId: string;
  readonly mode: RuntimeThreadMemoryMode;
}

export interface CompactRuntimeThreadCommand {
  readonly kind: 'compact-thread';
  readonly threadId: string;
}

export interface RunRuntimeThreadShellCommandCommand {
  readonly kind: 'run-thread-shell-command';
  readonly threadId: string;
  readonly command: string;
}

export interface ApproveRuntimeThreadGuardianDeniedActionCommand {
  readonly kind: 'approve-thread-guardian-denied-action';
  readonly threadId: string;
  readonly event: JsonValue;
}

export interface CleanRuntimeThreadBackgroundTerminalsCommand {
  readonly kind: 'clean-thread-background-terminals';
  readonly threadId: string;
}

export interface InjectRuntimeThreadItemsCommand {
  readonly kind: 'inject-thread-items';
  readonly threadId: string;
  readonly items: readonly JsonValue[];
}

export interface ReadRuntimeThreadCommand {
  readonly kind: 'read-thread';
  readonly threadId: string;
  readonly includeTurns: boolean;
}

export interface ListRuntimeThreadsCommand {
  readonly kind: 'list-threads';
  readonly workspace: string;
  readonly limit: number;
  readonly archived: boolean;
  readonly cursor?: string | null;
  readonly sortKey?: 'created_at' | 'updated_at' | null;
  readonly sortDirection?: 'asc' | 'desc' | null;
  readonly modelProviders?: readonly string[] | null;
  readonly sourceKinds?: readonly string[] | null;
  readonly useStateDbOnly?: boolean | null;
  readonly searchTerm?: string | null;
}

export interface ListLoadedRuntimeThreadsCommand {
  readonly kind: 'list-loaded-threads';
  readonly cursor?: string | null;
  readonly limit?: number | null;
}

export interface ListRuntimeThreadTurnsCommand {
  readonly kind: 'list-thread-turns';
  readonly threadId: string;
  readonly cursor?: string | null;
  readonly limit?: number | null;
  readonly sortDirection?: 'asc' | 'desc' | null;
}

export interface RollbackRuntimeThreadCommand {
  readonly kind: 'rollback-thread';
  readonly threadId: string;
  readonly numTurns: number;
}

export interface RuntimeTurnConfigCommandBase {
  readonly runtimeSettings: RuntimeSettings | null;
  readonly cwd?: string | null;
  readonly approvalPolicy?: string | null;
  readonly approvalsReviewer?: JsonValue;
  readonly sandboxPolicy?: JsonValue;
  readonly permissionProfile?: JsonValue;
  readonly serviceTier?: JsonValue;
  readonly summary?: JsonValue;
  readonly personality?: JsonValue;
  readonly outputSchema?: JsonValue;
  readonly collaborationMode?: JsonValue;
  readonly responsesapiClientMetadata?: JsonObject | null;
  readonly environments?: readonly RuntimeTurnEnvironment[] | null;
}

export interface RuntimeTurnEnvironment {
  readonly environmentId: string;
  readonly cwd: string;
}

export interface StartRuntimeTurnCommand extends RuntimeTurnConfigCommandBase {
  readonly kind: 'start-turn';
  readonly threadId: string;
  readonly message: string;
  readonly content: readonly RuntimeContentItem[];
}

export interface SteerRuntimeTurnCommand {
  readonly kind: 'steer-turn';
  readonly threadId: string;
  readonly expectedTurnId: string;
  readonly message: string;
  readonly content: readonly RuntimeContentItem[];
  readonly responsesapiClientMetadata?: JsonObject | null;
}

export interface StartRuntimeReviewCommand {
  readonly kind: 'start-review';
  readonly threadId: string;
  readonly target: JsonValue;
  readonly delivery?: JsonValue;
}

export interface InterruptRuntimeTurnCommand {
  readonly kind: 'interrupt-turn';
  readonly threadId: string;
  readonly turnId: string | null;
}

export interface RespondToRuntimeRequestCommand {
  readonly kind: 'respond-to-runtime-request';
  readonly method?: string;
  readonly requestId: string;
  readonly response: RuntimeRequestResponse;
}

export type RuntimeRequestResponse =
  | RuntimeRawRequestResponse
  | RuntimeDecisionRequestResponse
  | RuntimePermissionsRequestResponse
  | RuntimeMcpElicitationRequestResponse
  | RuntimeDynamicToolRequestResponse
  | RuntimeUserInputRequestResponse
  | RuntimeAuthRefreshRequestResponse;

export interface RuntimeRawRequestResponse {
  readonly kind: 'raw';
  readonly value: JsonValue;
}

export interface RuntimeDecisionRequestResponse {
  readonly kind: 'decision';
  readonly decision: JsonValue;
}

export interface RuntimePermissionsRequestResponse {
  readonly kind: 'permissions';
  readonly permissions: JsonValue;
  readonly scope?: JsonValue;
  readonly strictAutoReview?: boolean | null;
}

export interface RuntimeMcpElicitationRequestResponse {
  readonly kind: 'mcp-elicitation';
  readonly action: JsonValue;
  readonly content: JsonValue | null;
  readonly meta?: JsonValue;
}

export interface RuntimeDynamicToolRequestResponse {
  readonly kind: 'dynamic-tool';
  readonly contentItems: readonly JsonValue[];
  readonly success: boolean;
}

export interface RuntimeUserInputRequestResponse {
  readonly kind: 'user-input';
  readonly answers: JsonObject;
}

export interface RuntimeAuthRefreshRequestResponse {
  readonly kind: 'auth-refresh';
  readonly accessToken: string;
  readonly chatgptAccountId: string;
  readonly chatgptPlanType: string | null;
}

export type RuntimeEvent =
  | RuntimeInputRequestedEvent
  | RuntimeInputResolvedEvent
  | RuntimeThreadStartedEvent
  | RuntimeThreadStatusChangedEvent
  | RuntimeThreadNameUpdatedEvent
  | RuntimeThreadArchivedEvent
  | RuntimeThreadUnarchivedEvent
  | RuntimeThreadClosedEvent
  | RuntimeThreadTokenUsageUpdatedEvent
  | RuntimeTurnStartedEvent
  | RuntimeItemStartedEvent
  | RuntimeItemDeltaEvent
  | RuntimeItemCompletedEvent
  | RuntimeTurnDiffUpdatedEvent
  | RuntimeTurnPlanUpdatedEvent
  | RuntimeCodexNotificationEvent
  | RuntimeTurnCompletedEvent
  | RuntimeSystemNoticeEvent
  | RuntimeErrorEvent;

export type RuntimeInputKind = 'approval' | 'form' | 'auth' | 'tool-response' | 'unknown';

export interface RuntimeInputRequestedEvent {
  readonly kind: 'runtime-input-requested';
  readonly requestId: string;
  readonly method?: string;
  readonly threadId?: string | null;
  readonly turnId?: string | null;
  readonly itemId?: string | null;
  readonly inputKind: RuntimeInputKind;
  readonly title: string;
  readonly prompt: string;
  readonly data?: JsonObject;
}

export interface RuntimeInputResolvedEvent {
  readonly kind: 'runtime-input-resolved';
  readonly threadId: string;
  readonly requestId: string;
}

export interface RuntimeThreadStartedEvent {
  readonly kind: 'runtime-thread-started';
  readonly thread: RuntimeThread;
}

export interface RuntimeThreadStatusChangedEvent {
  readonly kind: 'runtime-thread-status-changed';
  readonly threadId: string;
  readonly status?: RuntimeThreadStatus;
}

export interface RuntimeThreadNameUpdatedEvent {
  readonly kind: 'runtime-thread-name-updated';
  readonly threadId: string;
  readonly name?: string | null;
}

export interface RuntimeThreadArchivedEvent {
  readonly kind: 'runtime-thread-archived';
  readonly threadId: string;
}

export interface RuntimeThreadUnarchivedEvent {
  readonly kind: 'runtime-thread-unarchived';
  readonly threadId: string;
}

export interface RuntimeThreadClosedEvent {
  readonly kind: 'runtime-thread-closed';
  readonly threadId: string;
}

export interface RuntimeThreadTokenUsageUpdatedEvent {
  readonly kind: 'runtime-thread-token-usage-updated';
  readonly threadId: string;
  readonly turnId: string;
  readonly tokenUsage: JsonObject;
}

export interface RuntimeTurnStartedEvent {
  readonly kind: 'runtime-turn-started';
  readonly threadId: string;
  readonly turn?: RuntimeTurn;
  readonly turnId: string;
}

export interface RuntimeItemStartedEvent {
  readonly kind: 'runtime-item-started';
  readonly threadId: string;
  readonly turnId: string;
  readonly item: RuntimeThreadItem;
}

export type RuntimeItemDeltaKind =
  | 'agent-message'
  | 'plan'
  | 'reasoning-summary-text'
  | 'reasoning-summary-part'
  | 'reasoning-text'
  | 'command-output'
  | 'terminal-interaction'
  | 'file-change-output'
  | 'file-change-patch'
  | 'mcp-tool-progress';

export interface RuntimeItemDeltaEvent {
  readonly kind: 'runtime-item-delta';
  readonly threadId: string;
  readonly turnId: string;
  readonly itemId: string;
  readonly deltaKind: RuntimeItemDeltaKind;
  readonly text: string | null;
  readonly data?: JsonObject;
}

export interface RuntimeItemCompletedEvent {
  readonly kind: 'runtime-item-completed';
  readonly threadId: string;
  readonly turnId: string;
  readonly item: RuntimeThreadItem;
}

export interface RuntimeTurnDiffUpdatedEvent {
  readonly kind: 'runtime-turn-diff-updated';
  readonly threadId: string;
  readonly turnId: string;
  readonly diff: string;
}

export interface RuntimeTurnPlanUpdatedEvent {
  readonly kind: 'runtime-turn-plan-updated';
  readonly threadId: string;
  readonly turnId: string;
  readonly explanation: string | null;
  readonly plan: readonly JsonValue[];
}

export type RuntimeCodexNotificationSemanticKind =
  | 'hook-started'
  | 'hook-completed'
  | 'auto-approval-review-started'
  | 'auto-approval-review-completed'
  | 'raw-response-item-completed'
  | 'command-exec-output-delta'
  | 'skills-changed'
  | 'mcp-server-oauth-login-completed'
  | 'mcp-server-status-updated'
  | 'account-updated'
  | 'account-rate-limits-updated'
  | 'app-list-updated'
  | 'external-agent-config-import-completed'
  | 'fs-changed'
  | 'context-compacted'
  | 'model-rerouted'
  | 'model-verification'
  | 'guardian-warning'
  | 'deprecation-notice'
  | 'config-warning'
  | 'fuzzy-file-search-session-updated'
  | 'fuzzy-file-search-session-completed'
  | 'windows-world-writable-warning'
  | 'windows-sandbox-setup-completed'
  | 'thread-realtime-started'
  | 'thread-realtime-item-added'
  | 'thread-realtime-transcript-delta'
  | 'thread-realtime-transcript-done'
  | 'thread-realtime-output-audio-delta'
  | 'thread-realtime-sdp'
  | 'thread-realtime-closed'
  | 'account-login-completed';

export interface RuntimeCodexNotificationEvent {
  readonly kind: 'runtime-codex-notification';
  readonly semanticKind: RuntimeCodexNotificationSemanticKind;
  readonly method?: string;
  readonly threadId: string | null;
  readonly turnId: string | null;
  readonly itemId: string | null;
  readonly data: JsonObject;
}

export type RuntimeTerminalTurnStatus = 'completed' | 'interrupted' | 'failed';
export type RuntimeTurnStatus = 'inProgress' | RuntimeTerminalTurnStatus;

export interface RuntimeTurnCompletedEvent {
  readonly kind: 'runtime-turn-completed';
  readonly threadId: string;
  readonly turn?: RuntimeTurn;
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
  readonly details?: string | null;
}

export type RuntimeResult =
  | RuntimeOkResult
  | RuntimeThreadStartedResult
  | RuntimeThreadResumedResult
  | RuntimeThreadForkedResult
  | RuntimeThreadUpdatedResult
  | RuntimeThreadUnsubscribeResult
  | RuntimeThreadLoadedListResult
  | RuntimeThreadElicitationResult
  | RuntimeThreadReadResult
  | RuntimeThreadsListedResult
  | RuntimeThreadTurnsListedResult
  | RuntimeTurnStartedResult
  | RuntimeTurnSteeredResult
  | RuntimeReviewStartedResult
  | RuntimeRequestRespondedResult;

export interface RuntimeOkResult {
  readonly kind: 'ok';
}

export interface RuntimeThreadEffectiveConfig {
  readonly model: string | null;
  readonly modelProvider?: string | null;
  readonly serviceTier: JsonValue;
  readonly cwd?: string | null;
  readonly instructionSources: readonly string[];
  readonly approvalPolicy: JsonValue;
  readonly approvalsReviewer: JsonValue;
  readonly sandbox: JsonValue;
  readonly permissionProfile: JsonValue;
  readonly reasoningEffort: string | null;
}

export interface RuntimeThreadStartedResult {
  readonly kind: 'thread-started';
  readonly threadId: string;
  readonly thread?: RuntimeThread;
  readonly effectiveConfig?: RuntimeThreadEffectiveConfig;
}

export interface RuntimeThreadResumedResult {
  readonly kind: 'thread-resumed';
  readonly threadId: string;
  readonly thread?: RuntimeThread;
  readonly effectiveConfig?: RuntimeThreadEffectiveConfig;
  readonly snapshot: RuntimeThreadSnapshot;
}

export interface RuntimeThreadForkedResult {
  readonly kind: 'thread-forked';
  readonly threadId: string;
  readonly thread?: RuntimeThread;
  readonly effectiveConfig?: RuntimeThreadEffectiveConfig;
  readonly snapshot: RuntimeThreadSnapshot;
}

export type RuntimeThreadUpdateOperation = 'unarchive' | 'metadata-update' | 'rollback';

export interface RuntimeThreadUpdatedResult {
  readonly kind: 'thread-updated';
  readonly operation: RuntimeThreadUpdateOperation;
  readonly threadId: string;
  readonly thread?: RuntimeThread;
  readonly snapshot?: RuntimeThreadSnapshot;
}

export type RuntimeThreadUnsubscribeStatus = 'notLoaded' | 'notSubscribed' | 'unsubscribed';

export interface RuntimeThreadUnsubscribeResult {
  readonly kind: 'thread-unsubscribed';
  readonly threadId: string;
  readonly status: RuntimeThreadUnsubscribeStatus;
}

export interface RuntimeThreadLoadedListResult {
  readonly kind: 'loaded-threads-listed';
  readonly threadIds: readonly string[];
  readonly nextCursor?: string | null;
}

export interface RuntimeThreadElicitationResult {
  readonly kind: 'thread-elicitation-updated';
  readonly threadId: string;
  readonly count: number;
  readonly paused: boolean;
}

export interface RuntimeThreadReadResult {
  readonly kind: 'thread-read';
  readonly threadId: string;
  readonly thread?: RuntimeThread;
  readonly snapshot: RuntimeThreadSnapshot;
}

export interface RuntimeThreadsListedResult {
  readonly kind: 'threads-listed';
  readonly threads: readonly RuntimeThread[];
  readonly nextCursor?: string | null;
  readonly backwardsCursor?: string | null;
}

export interface RuntimeThreadTurnsListedResult {
  readonly kind: 'thread-turns-listed';
  readonly threadId: string;
  readonly turns?: readonly RuntimeTurn[];
  readonly nextCursor?: string | null;
  readonly backwardsCursor?: string | null;
}

export interface RuntimeTurnStartedResult {
  readonly kind: 'turn-started';
  readonly turnId: string;
  readonly turn?: RuntimeTurn;
}

export interface RuntimeTurnSteeredResult {
  readonly kind: 'turn-steered';
  readonly turnId: string;
}

export interface RuntimeReviewStartedResult {
  readonly kind: 'review-started';
  readonly turnId: string;
  readonly reviewThreadId: string;
  readonly turn?: RuntimeTurn;
}

export interface RuntimeRequestRespondedResult {
  readonly kind: 'runtime-request-responded';
  readonly requestId: string;
}

export type RuntimeThreadStatus = JsonValue;

export interface RuntimeThread {
  readonly threadId: string;
  readonly title: string | null;
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
  readonly name?: string | null;
  readonly turns?: readonly RuntimeTurn[];
  readonly raw?: JsonObject;
}

export interface RuntimeThreadSnapshot {
  readonly threadId: string;
  readonly title: string | null;
  readonly items: readonly RuntimeTimelineItem[];
  readonly pendingInputs: readonly RuntimePendingInput[];
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

export interface RuntimePendingInput {
  readonly requestId: string;
  readonly method?: string;
  readonly threadId?: string | null;
  readonly turnId?: string | null;
  readonly itemId?: string | null;
  readonly inputKind: RuntimeInputKind;
  readonly prompt: string;
  readonly title?: string;
  readonly data?: JsonObject;
}

export type RuntimeEventHandler = (event: RuntimeEvent) => void;
export type Unsubscribe = () => void;

export interface RuntimePort {
  send(input: RuntimeCommand): Promise<RuntimeResult>;
  subscribe(handler: RuntimeEventHandler): Unsubscribe;
  close(): Promise<void>;
}
