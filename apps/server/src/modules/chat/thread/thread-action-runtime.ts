import { resolveSessionWorkspace } from '../shared/chat-session-state.js';
import type { ChatSessionRegistry, ChatSessionState } from '../shared/chat-types.js';

interface ThreadActionRuntimeAttachment {
  attached: boolean;
  reason: string;
  runtimeGatewayGeneration: number | null;
  currentGatewayGeneration: number | null;
}

interface ThreadActionRecoveryContext {
  trigger: 'thread_action';
}

interface ThreadActionRecoveryLogInput {
  trigger: ThreadActionRecoveryContext['trigger'];
  runtime: ChatSessionState;
  slotId: string;
  threadId: string;
  workspace: string;
  attachment: ThreadActionRuntimeAttachment;
}

interface RestoreThreadActionRuntimeFromThreadInput {
  viewerId: string;
  slotId: string;
  workspace?: string;
  threadId: string;
  runtimeSettings?: ChatSessionState['appliedThreadRuntimeOverrides'];
  recoveryContext?: ThreadActionRecoveryContext | null;
}

interface StoreThreadActionRuntimeInput {
  viewerId: string;
  slotId: string;
  workspace?: string;
  threadId: string;
  runtimeSettings?: ChatSessionState['appliedThreadRuntimeOverrides'];
  threadResult: unknown;
}

interface ThreadActionSessionRecovery {
  getRuntimeAttachment(
    runtime: ChatSessionState | null | undefined,
  ): ThreadActionRuntimeAttachment;
  logRuntimeRecovery(input: ThreadActionRecoveryLogInput): void;
  restoreRuntime(
    input: RestoreThreadActionRuntimeFromThreadInput,
  ): Promise<ChatSessionState>;
  storeRuntimeFromResult(
    input: StoreThreadActionRuntimeInput,
  ): Promise<ChatSessionState>;
}

interface CreateEnsureAttachedThreadActionRuntimeInput {
  registry: ChatSessionRegistry;
  sessionRecovery: ThreadActionSessionRecovery;
}

interface EnsureAttachedThreadActionRuntimeInput {
  slotId: string;
  threadId: string;
  workspace?: string;
}

interface RestoreThreadActionRuntimeInput {
  runtime: ChatSessionState;
  workspace: string;
  threadId: string;
  runtimeSettings?: ChatSessionState['appliedThreadRuntimeOverrides'];
  result: unknown;
  sessionRecovery: ThreadActionSessionRecovery;
}

function hasHydratedThreadResult(result: unknown) {
  if (!result || typeof result !== 'object') {
    return false;
  }

  if (Array.isArray((result as { messages?: unknown[] }).messages)) {
    return true;
  }

  return Object.prototype.hasOwnProperty.call(result, 'latestTurn');
}

export function createEnsureAttachedThreadActionRuntime({
  registry,
  sessionRecovery,
}: CreateEnsureAttachedThreadActionRuntimeInput) {
  return async function ensureAttachedThreadActionRuntime({
    slotId,
    threadId,
    workspace = '',
  }: EnsureAttachedThreadActionRuntimeInput) {
    const runtime = registry.getIdleRuntimeForThreadAction({ slotId, threadId });
    const attachment = sessionRecovery.getRuntimeAttachment(runtime);
    if (attachment.attached) {
      return runtime;
    }

    const resolvedWorkspace = resolveSessionWorkspace(runtime, workspace);
    sessionRecovery.logRuntimeRecovery({
      trigger: 'thread_action',
      runtime,
      slotId: runtime.slotId,
      threadId: runtime.threadId,
      workspace: resolvedWorkspace,
      attachment,
    });

    return sessionRecovery.restoreRuntime({
      viewerId: runtime.viewerId,
      slotId: runtime.slotId,
      workspace: resolvedWorkspace,
      threadId: runtime.threadId,
      runtimeSettings: runtime.appliedThreadRuntimeOverrides ?? undefined,
      recoveryContext: {
        trigger: 'thread_action',
      },
    });
  };
}

export async function restoreThreadActionRuntime({
  runtime,
  workspace,
  threadId,
  runtimeSettings,
  result,
  sessionRecovery,
}: RestoreThreadActionRuntimeInput) {
  if (hasHydratedThreadResult(result)) {
    return sessionRecovery.storeRuntimeFromResult({
      viewerId: runtime.viewerId,
      slotId: runtime.slotId,
      workspace,
      threadId,
      runtimeSettings,
      threadResult: result,
    });
  }

  return sessionRecovery.restoreRuntime({
    viewerId: runtime.viewerId,
    slotId: runtime.slotId,
    workspace,
    threadId,
    runtimeSettings,
  });
}
