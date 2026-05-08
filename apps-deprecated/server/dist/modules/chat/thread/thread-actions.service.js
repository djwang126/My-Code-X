import { createHttpError } from '../../../common/errors/http-error.js';
import { createThreadBootstrapState } from './thread-bootstrap-policy.js';
import { canRuntimeInterrupt, markRuntimeTurnInterrupting } from '../shared/chat-turn-lifecycle.js';
async function createForkThreadBootstrapState({ runtimeSettings, promptOverrideResolver, }) {
    return createThreadBootstrapState({
        runtimeSettings,
        promptOverrideResolver,
        includeBaseInstructions: true,
    });
}
export function createThreadActionsService({ codexGateway, registry, promptOverrideResolver = null, sessionService }) {
    async function interruptTurn({ slotId, threadId }) {
        const runtime = registry.getRuntimeForSelection({ slotId, threadId });
        if (!runtime) {
            throw createHttpError('thread not found', 404);
        }
        if (!canRuntimeInterrupt(runtime)) {
            throw createHttpError('turn not in progress', 409);
        }
        await codexGateway.interruptTurn({
            threadId: runtime.threadId,
            turnId: runtime.turnExecution.activeTurnId,
        });
        markRuntimeTurnInterrupting(runtime);
        runtime.lastUpdatedAt = new Date().toISOString();
        return {
            ok: true,
            threadId: runtime.threadId,
            turnExecution: {
                ...runtime.turnExecution,
            },
        };
    }
    async function compactThread({ slotId, threadId, workspace = '' }) {
        const runtime = await sessionService.ensureLoadedThreadRuntime({ slotId, threadId, workspace });
        await codexGateway.compactThread({
            threadId: runtime.threadId,
            workspace: workspace || runtime.workspace,
        });
        return {
            ok: true,
            threadId: runtime.threadId,
        };
    }
    async function rollbackThread({ slotId, threadId, workspace = '', numTurns, }) {
        const runtime = await sessionService.ensureLoadedThreadRuntime({ slotId, threadId, workspace });
        if (!Number.isInteger(numTurns) || numTurns < 1) {
            throw createHttpError('numTurns must be a positive integer', 400);
        }
        await codexGateway.rollbackThread({
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
    async function forkThread({ slotId, threadId, workspace = '', preservedTurnCount, }) {
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
        const forkedThread = await codexGateway.forkThread({
            threadId: runtime.threadId,
            workspace: workspace || runtime.workspace,
            runtimeSettings: bootstrapState.normalizedRuntimeSettings,
            baseInstructions: bootstrapState.baseInstructions,
        });
        const rollbackTurns = totalTurnCount - preservedTurnCount;
        if (rollbackTurns > 0) {
            await codexGateway.rollbackThread({
                threadId: forkedThread.threadId,
                numTurns: rollbackTurns,
            });
        }
        return {
            ok: true,
            threadId: forkedThread.threadId,
        };
    }
    async function startReview({ slotId, threadId, workspace = '', delivery = 'inline', target, }) {
        const runtime = await sessionService.ensureLoadedThreadRuntime({ slotId, threadId, workspace });
        const result = await codexGateway.startReview({
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
    async function listThreadHistory({ workspace = '', limit = 20 }) {
        const normalizedWorkspace = String(workspace || '').trim();
        if (!normalizedWorkspace) {
            return [];
        }
        const [activeThreads, archivedThreads] = await Promise.all([
            codexGateway.listThreads({ workspace: normalizedWorkspace, limit, archived: false }),
            codexGateway.listThreads({ workspace: normalizedWorkspace, limit, archived: true }),
        ]);
        const threadsById = new Map();
        for (const threadPage of [activeThreads, archivedThreads]) {
            for (const thread of threadPage) {
                if (!thread?.id || threadsById.has(thread.id)) {
                    continue;
                }
                threadsById.set(thread.id, thread);
            }
        }
        return Array.from(threadsById.values())
            .sort((left, right) => right.updatedAt - left.updatedAt)
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
//# sourceMappingURL=thread-actions.service.js.map