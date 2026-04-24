import type {
  ChatTurn,
  SessionError,
  SessionThreadStatus,
} from '@my-code-x/contracts';
import type { LooseRecord, RuntimeSettings } from '../../../common/codex/codex-types.js';

export interface ChatTimelineItem extends LooseRecord {
  id: string;
  kind: string;
  itemType: string;
  text: string;
  state: string;
  threadId: string;
  turnId: string | null;
  raw: LooseRecord;
  role?: string;
  content?: LooseRecord[];
  status?: string;
}

export interface ChatSessionNotice extends LooseRecord {
  id: string;
}

export interface ChatPendingRequest extends LooseRecord {
  id: string;
  threadId?: string;
  submitState?: string;
  raw?: LooseRecord;
}

export interface ChatSessionState {
  slotId: string;
  viewerId: string;
  workspace: string;
  threadId: string;
  latestTurn: ChatTurn | null;
  collaborationModeKind?: string;
  appliedThreadRuntimeOverrides?: RuntimeSettings | null;
  threadName: string;
  threadStatus: SessionThreadStatus | null;
  threadStatusText: string;
  tokenUsageText: string;
  messages: ChatTimelineItem[];
  notices: ChatSessionNotice[];
  pendingRequests: ChatPendingRequest[];
  lastError: SessionError | null;
  gatewayGeneration?: number;
  lastUpdatedAt: string;
}

export interface RuntimeAttachment {
  attached: boolean;
  reason: string;
  runtimeGatewayGeneration: number | null;
  currentGatewayGeneration: number | null;
}

export interface ChatEventEmitter {
  emitEvent(selection: { slotId: string; threadId?: string }, event: LooseRecord): void;
  emitTimelineItemUpdated(runtime: ChatSessionState, item: ChatTimelineItem): void;
  emitSessionMetaUpdated(runtime: ChatSessionState): void;
  emitSystemNotice(runtime: ChatSessionState, notice: ChatSessionNotice): void;
  emitPendingRequestUpdated(runtime: ChatSessionState, request: ChatPendingRequest): void;
  emitPendingRequestResolved(runtime: ChatSessionState, requestId: string, notice: ChatSessionNotice): void;
  subscribe(selection: { slotId: string; threadId?: string }, listener: (event: LooseRecord) => void): () => void;
}

export interface ChatSessionRegistry {
  hasThreadlessPendingRequests(runtime: ChatSessionState | null | undefined): boolean;
  releaseRuntimeOwnership(runtime: ChatSessionState | null | undefined): void;
  getConflictingThreadRuntime(input: { slotId: string; threadId: string }): ChatSessionState | null;
  rebindThreadlessPendingRequests(sourceRuntime: ChatSessionState | null | undefined, targetRuntime: ChatSessionState): void;
  findRuntimeForPendingRequest(input: {
    requestId: string;
    threadId?: string;
    fallbackRuntime?: ChatSessionState | null;
  }): ChatSessionState | null;
  storeRuntime(runtime: ChatSessionState): void;
  getRuntimeBySlotId(slotId: string): ChatSessionState | null;
  getTargetRuntimesForEvent(event: LooseRecord): ChatSessionState[];
  getRuntimeForSelection(input: { slotId?: string; threadId?: string }): ChatSessionState | null;
  getIdleRuntimeForThreadAction(input: { slotId: string; threadId: string }): ChatSessionState;
  listRuntimes(): ChatSessionState[];
  deleteThreadlessRequestOwner(requestId: string): void;
}
