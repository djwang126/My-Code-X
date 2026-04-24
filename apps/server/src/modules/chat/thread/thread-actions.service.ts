import { serializeChatTurn } from '@my-code-x/contracts';
import { createHttpError } from '../../../common/errors/http-error.js';
import { createThreadBootstrapState } from './thread-bootstrap-policy.js';
import { canRuntimeInterrupt } from '../shared/chat-turn-state.js';
import type { ChatSessionRegistry, ChatSessionState } from '../shared/chat-types.js';
import type { CodexGatewayLike, PromptOverrideResolver, RuntimeSettings } from '../../../common/codex/codex-types.js';
interface ThreadActionsServiceDependencies {
    codexGateway: CodexGatewayLike;
    registry: ChatSessionRegistry;
    promptOverrideResolver?: PromptOverrideResolver | null;
    sessionService: {
        ensureLoadedThreadRuntime(input: {
            slotId: string;
            threadId: string;
            workspace?: string;
        }): Promise<ChatSessionState>;
        restoreRuntime(input: {
            viewerId: string;
            slotId: string;
            workspace?: string;
            threadId: string;
            runtimeSettings?: ChatSessionState['appliedThreadRuntimeOverrides'];
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
        const runtime = await sessionService.ensureLoadedThreadRuntime({ slotId, threadId, workspace });
        await codexGateway.compactThread!({
            threadId: runtime.threadId,
            workspace: workspace || runtime.workspace,
        });
        return {
            ok: true,
            threadId: runtime.threadId,
        };
    }
    async function rollbackThread({ slotId, threadId, workspace = '', numTurns, }: {
        slotId: string;
        threadId: string;
        workspace?: string;
        numTurns: number;
    }) {
        const runtime = await sessionService.ensureLoadedThreadRuntime({ slotId, threadId, workspace });
        if (!Number.isInteger(numTurns) || numTurns < 1) {
            throw createHttpError('numTurns must be a positive integer', 400);
        }
        await codexGateway.rollbackThread!({
            threadId: runtime.threadId,
            workspace: workspace || runtime.workspace,
            numTurns,
        });
        await sessionService.restoreRuntime({
            viewerId: runtime.viewerId,
            slotId: runtime.slotId,
            workspace: workspace || runtime.workspace,
            threadId: runtime.threadId,
            runtimeSettings: runtime.appliedThreadRuntimeOverrides ?? undefined,
        });
        return {
            ok: true,
            threadId: runtime.threadId,
        };
    }
    async function forkThread({ slotId, threadId, workspace = '', preservedTurnCount, }: {
        slotId: string;
        threadId: string;
        workspace?: string;
        preservedTurnCount: number;
    }) {
        const runtime = await sessionService.ensureLoadedThreadRuntime({ slotId, threadId, workspace });
        const bootstrapState = await createForkThreadBootstrapState({
            runtimeSettings: runtime.appliedThreadRuntimeOverrides,
            promptOverrideResolver,
        });
        const totalTurnCount = runtime.messages.filter(message => message.kind === 'message' && message.role === 'user' && message.threadId === runtime.threadId).length;
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
        const rollbackTurns = totalTurnCount - preservedTurnCount;
        if (rollbackTurns > 0) {
            await codexGateway.rollbackThread!({
                threadId: forkedThread.threadId,
                numTurns: rollbackTurns,
            });
        }
        return {
            ok: true,
            threadId: forkedThread.threadId,
        };
    }
    async function startReview({ slotId, threadId, workspace = '', delivery = 'inline', target, }: {
        slotId: string;
        threadId: string;
        workspace?: string;
        delivery?: string;
        target?: string;
    }) {
        const runtime = await sessionService.ensureLoadedThreadRuntime({ slotId, threadId, workspace });
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
        interruptTurn,
        compactThread,
        rollbackThread,
        forkThread,
        startReview,
        listThreadHistory,
    };
}

