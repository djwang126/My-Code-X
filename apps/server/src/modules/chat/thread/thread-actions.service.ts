import { serializeChatTurn } from '@my-code-x/contracts';
import { createHttpError } from '../../../common/errors/http-error.js';
import { createChatEventsSnapshotPayload } from '../contracts/chat.contract.js';
import { createThreadBootstrapState } from './thread-bootstrap-policy.js';
import { resolveSessionWorkspace } from '../shared/chat-session-state.js';
import {
    createEnsureAttachedThreadActionRuntime,
    restoreThreadActionRuntime,
} from './thread-action-runtime.js';
import { countDistinctUserTurns } from './thread-turn-count.js';
import { canRuntimeInterrupt, isRuntimeTurnActive } from '../shared/chat-turn-state.js';
import type { ChatSessionRegistry, ChatSessionState } from '../shared/chat-types.js';
import type { CodexGatewayLike, PromptOverrideResolver, RuntimeSettings } from '../../../common/codex/codex-types.js';
interface ThreadActionsServiceDependencies {
    codexGateway: CodexGatewayLike;
    registry: ChatSessionRegistry;
    promptOverrideResolver?: PromptOverrideResolver | null;
    sessionService: {
        getRuntimeAttachment(runtime: ChatSessionState | null | undefined): {
            attached: boolean;
            reason: string;
            runtimeGatewayGeneration: number | null;
            currentGatewayGeneration: number | null;
        };
        logRuntimeRecovery(input: {
            trigger: 'thread_action';
            runtime: ChatSessionState;
            slotId: string;
            threadId: string;
            workspace: string;
            attachment: {
                attached: boolean;
                reason: string;
                runtimeGatewayGeneration: number | null;
                currentGatewayGeneration: number | null;
            };
        }): void;
        restoreRuntime(input: {
            viewerId: string;
            slotId: string;
            workspace?: string;
            threadId: string;
            runtimeSettings?: ChatSessionState['appliedThreadRuntimeOverrides'];
            recoveryContext?: {
                trigger: 'thread_action';
            };
        }): Promise<ChatSessionState>;
        startThreadForRuntime(input: {
            viewerId: string;
            slotId: string;
            workspace?: string;
            runtimeSettings?: ChatSessionState['appliedThreadRuntimeOverrides'];
        }): Promise<ChatSessionState>;
        storeRuntimeFromResult(input: {
            viewerId: string;
            slotId: string;
            workspace?: string;
            threadId: string;
            runtimeSettings?: ChatSessionState['appliedThreadRuntimeOverrides'];
            threadResult: any;
        }): Promise<ChatSessionState>;
    };
}

interface ForkThreadBootstrapStateInput {
    runtimeSettings?: RuntimeSettings | null;
    promptOverrideResolver?: PromptOverrideResolver | null;
}

async function createForkThreadBootstrapState({ runtimeSettings, promptOverrideResolver, }: ForkThreadBootstrapStateInput) {
    return createThreadBootstrapState({
        runtimeSettings,
        promptOverrideResolver,
        includeBaseInstructions: true,
    });
}

export function createThreadActionsService({ codexGateway, registry, promptOverrideResolver = null, sessionService }: ThreadActionsServiceDependencies) {
    const ensureAttachedThreadActionRuntime = createEnsureAttachedThreadActionRuntime({
        registry,
        sessionRecovery: sessionService,
    });
    async function startThread({ viewerId, slotId, workspace = '', runtimeSettings, }: {
        viewerId: string;
        slotId: string;
        workspace?: string;
        runtimeSettings?: RuntimeSettings | null;
    }) {
        const slotRuntime = registry.getRuntimeBySlotId(slotId);
        if (slotRuntime && isRuntimeTurnActive(slotRuntime)) {
            throw createHttpError('turn already in progress', 409);
        }
        const resolvedWorkspace = resolveSessionWorkspace(slotRuntime, workspace);
        if (!resolvedWorkspace) {
            throw createHttpError('workspace is required', 400);
        }
        const startedRuntime = await sessionService.startThreadForRuntime({
            viewerId,
            slotId,
            workspace: resolvedWorkspace,
            runtimeSettings: runtimeSettings ?? undefined,
        });
        return {
            kind: 'threadStarted',
            threadId: startedRuntime.threadId,
            snapshot: createChatEventsSnapshotPayload(startedRuntime),
        };
    }
    async function resumeThread({ viewerId, slotId, threadId, workspace = '', runtimeSettings, }: {
        viewerId: string;
        slotId: string;
        threadId: string;
        workspace?: string;
        runtimeSettings?: RuntimeSettings | null;
    }) {
        const runtime = registry.getRuntimeForSelection({ slotId, threadId });
        if (runtime) {
            const attachment = sessionService.getRuntimeAttachment(runtime);
            if (attachment.attached) {
                return {
                    kind: 'threadResumed',
                    threadId: runtime.threadId,
                    snapshot: createChatEventsSnapshotPayload(runtime),
                };
            }
            const resolvedWorkspace = resolveSessionWorkspace(runtime, workspace);
            sessionService.logRuntimeRecovery({
                trigger: 'thread_action',
                runtime,
                slotId: runtime.slotId,
                threadId: runtime.threadId,
                workspace: resolvedWorkspace,
                attachment,
            });
            const restoredRuntime = await sessionService.restoreRuntime({
                viewerId,
                slotId,
                workspace: resolvedWorkspace,
                threadId: runtime.threadId,
                runtimeSettings: runtimeSettings ?? runtime.appliedThreadRuntimeOverrides ?? undefined,
                recoveryContext: {
                    trigger: 'thread_action',
                },
            });
            return {
                kind: 'threadResumed',
                threadId: restoredRuntime.threadId,
                snapshot: createChatEventsSnapshotPayload(restoredRuntime),
            };
        }
        const restoredRuntime = await sessionService.restoreRuntime({
            viewerId,
            slotId,
            workspace,
            threadId,
            runtimeSettings: runtimeSettings ?? undefined,
            recoveryContext: {
                trigger: 'thread_action',
            },
        });
        return {
            kind: 'threadResumed',
            threadId: restoredRuntime.threadId,
            snapshot: createChatEventsSnapshotPayload(restoredRuntime),
        };
    }
    async function interruptTurn({ slotId, threadId }: {
        slotId: string;
        threadId: string;
    }) {
        const runtime = registry.getRuntimeForSelection({ slotId, threadId });
        if (!runtime) {
            throw createHttpError('thread not found', 404);
        }
        if (!canRuntimeInterrupt(runtime)) {
            throw createHttpError('turn not in progress', 409);
        }
        const latestTurn = runtime.latestTurn;
        if (!latestTurn) {
            throw createHttpError('turn not in progress', 409);
        }
        await codexGateway.interruptTurn!({
            threadId: runtime.threadId,
            turnId: latestTurn.id,
        });
        runtime.lastUpdatedAt = new Date().toISOString();
        return {
            ok: true,
            threadId: runtime.threadId,
            turn: serializeChatTurn(runtime.latestTurn, { fieldName: 'interruptTurn.latestTurn' }),
        };
    }
    async function compactThread({ slotId, threadId, workspace = '' }: {
        slotId: string;
        threadId: string;
        workspace?: string;
    }) {
        const runtime = await ensureAttachedThreadActionRuntime({ slotId, threadId, workspace });
        await codexGateway.compactThread!({
            threadId: runtime.threadId,
            workspace: workspace || runtime.workspace,
        });
        return {
            kind: 'threadCompactStarted',
            threadId: runtime.threadId,
        };
    }
    async function rollbackThread({ slotId, threadId, workspace = '', numTurns, }: {
        slotId: string;
        threadId: string;
        workspace?: string;
        numTurns: number;
    }) {
        const runtime = await ensureAttachedThreadActionRuntime({ slotId, threadId, workspace });
        if (!Number.isInteger(numTurns) || numTurns < 1) {
            throw createHttpError('numTurns must be a positive integer', 400);
        }
        const rollbackResult = await codexGateway.rollbackThread!({
            threadId: runtime.threadId,
            workspace: workspace || runtime.workspace,
            numTurns,
        });
        const restoredRuntime = await restoreThreadActionRuntime({
            runtime,
            workspace: workspace || runtime.workspace,
            threadId: runtime.threadId,
            runtimeSettings: runtime.appliedThreadRuntimeOverrides ?? undefined,
            result: rollbackResult,
            sessionRecovery: sessionService,
        });
        return {
            kind: 'threadRolledBack',
            threadId: runtime.threadId,
            snapshot: createChatEventsSnapshotPayload(restoredRuntime),
        };
    }
    async function forkThread({ slotId, threadId, workspace = '', preservedTurnCount, }: {
        slotId: string;
        threadId: string;
        workspace?: string;
        preservedTurnCount: number;
    }) {
        const runtime = await ensureAttachedThreadActionRuntime({ slotId, threadId, workspace });
        const bootstrapState = await createForkThreadBootstrapState({
            runtimeSettings: runtime.appliedThreadRuntimeOverrides,
            promptOverrideResolver,
        });
        const totalTurnCount = countDistinctUserTurns(runtime.messages, runtime.threadId);
        if (!Number.isInteger(preservedTurnCount) || preservedTurnCount < 1) {
            throw createHttpError('preservedTurnCount must be a positive integer', 400);
        }
        if (!totalTurnCount) {
            throw createHttpError('thread has no turns to fork', 409);
        }
        if (preservedTurnCount > totalTurnCount) {
            throw createHttpError('preservedTurnCount exceeds available turns', 400);
        }
        const forkedThread = await codexGateway.forkThread!({
            threadId: runtime.threadId,
            workspace: workspace || runtime.workspace,
            runtimeSettings: bootstrapState.normalizedRuntimeSettings,
            baseInstructions: bootstrapState.baseInstructions,
        });
        let threadResult = forkedThread;
        const rollbackTurns = totalTurnCount - preservedTurnCount;
        if (rollbackTurns > 0) {
            threadResult = await codexGateway.rollbackThread!({
                threadId: forkedThread.threadId,
                numTurns: rollbackTurns,
            });
        }
        const restoredRuntime = await restoreThreadActionRuntime({
            runtime,
            workspace: workspace || runtime.workspace,
            threadId: forkedThread.threadId,
            runtimeSettings: bootstrapState.normalizedRuntimeSettings,
            result: threadResult,
            sessionRecovery: sessionService,
        });
        return {
            kind: 'threadForked',
            sourceThreadId: runtime.threadId,
            threadId: forkedThread.threadId,
            snapshot: createChatEventsSnapshotPayload(restoredRuntime),
        };
    }
    async function startReview({ slotId, threadId, workspace = '', delivery = 'inline', target, }: {
        slotId: string;
        threadId: string;
        workspace?: string;
        delivery?: string;
        target?: string;
    }) {
        const runtime = await ensureAttachedThreadActionRuntime({ slotId, threadId, workspace });
        const result = await codexGateway.startReview!({
            threadId: runtime.threadId,
            workspace: workspace || runtime.workspace,
            delivery,
            target,
        });
        return {
            ok: true,
            ...(result?.reviewThreadId ? { reviewThreadId: result.reviewThreadId } : {}),
        };
    }
    async function listThreadHistory({ workspace = '', limit = 20 }: {
        workspace?: string;
        limit?: number;
    }) {
        const normalizedWorkspace = String(workspace || '').trim();
        if (!normalizedWorkspace) {
            return [];
        }
        const [activeThreads, archivedThreads] = await Promise.all([
            codexGateway.listThreads!({ workspace: normalizedWorkspace, limit, archived: false }),
            codexGateway.listThreads!({ workspace: normalizedWorkspace, limit, archived: true }),
        ]);
        const threadsById = new Map<string, {
            id: string;
            updatedAt: number;
        } & Record<string, unknown>>();
        for (const threadPage of [activeThreads, archivedThreads] as Array<Array<{ id: string; updatedAt: number } & Record<string, unknown>>>) {
            for (const thread of threadPage) {
                if (!thread?.id || threadsById.has(thread.id)) {
                    continue;
                }
                threadsById.set(thread.id, thread);
            }
        }
        return Array.from(threadsById.values())
            .sort((left: any, right: any) => right.updatedAt - left.updatedAt)
            .slice(0, Math.max(1, limit));
    }
    return {
        startThread,
        resumeThread,
        interruptTurn,
        compactThread,
        rollbackThread,
        forkThread,
        startReview,
        listThreadHistory,
    };
}

