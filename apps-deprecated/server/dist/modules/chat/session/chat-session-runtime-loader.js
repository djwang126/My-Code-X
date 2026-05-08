import { createIdleSessionTurnExecution } from '@my-code-x/contracts';
import { assertSessionContextMatches, cloneSessionState, createSessionState, resolveSessionWorkspace, } from '../shared/chat-session-state.js';
export function createEnsureLoadedThreadRuntime({ registry, sessionRecovery }) {
    return async function ensureLoadedThreadRuntime({ slotId, threadId, workspace = '' }) {
        const runtime = registry.getIdleRuntimeForThreadAction({ slotId, threadId });
        const attachment = sessionRecovery.getRuntimeAttachment(runtime);
        if (attachment.attached) {
            return runtime;
        }
        sessionRecovery.logRuntimeRecovery({
            trigger: 'thread_action',
            runtime,
            slotId: runtime.slotId,
            threadId: runtime.threadId,
            workspace: resolveSessionWorkspace(runtime, workspace),
            attachment,
        });
        return sessionRecovery.restoreRuntime({
            viewerId: runtime.viewerId,
            slotId: runtime.slotId,
            workspace: resolveSessionWorkspace(runtime, workspace),
            threadId: runtime.threadId,
            runtimeSettings: runtime.appliedThreadRuntimeOverrides ?? undefined,
            recoveryContext: {
                trigger: 'thread_action',
            },
        });
    };
}
export function createHydrateSession({ now, registry, sessionRecovery }) {
    return async function hydrateSession({ viewerId, slotId, workspace = '', threadId = '', runtimeSettings, }) {
        const runtimeBySlot = registry.getRuntimeBySlotId(slotId);
        if (!threadId) {
            if (runtimeBySlot && !runtimeBySlot.threadId && runtimeBySlot.workspace === workspace) {
                return cloneSessionState(runtimeBySlot);
            }
            const emptyState = createSessionState({
                viewerId,
                slotId,
                workspace,
                threadId,
                turnExecution: createIdleSessionTurnExecution(),
                now,
            });
            if (runtimeBySlot && !runtimeBySlot.threadId) {
                registry.rebindThreadlessPendingRequests(runtimeBySlot, emptyState);
            }
            registry.storeRuntime(emptyState);
            return cloneSessionState(emptyState);
        }
        assertSessionContextMatches(runtimeBySlot, { workspace });
        if (runtimeBySlot && runtimeBySlot.threadId === threadId) {
            const attachment = sessionRecovery.getRuntimeAttachment(runtimeBySlot);
            if (attachment.attached) {
                return cloneSessionState(runtimeBySlot);
            }
            sessionRecovery.logRuntimeRecovery({
                trigger: 'hydrate_session',
                runtime: runtimeBySlot,
                slotId: runtimeBySlot.slotId,
                threadId: runtimeBySlot.threadId,
                workspace: resolveSessionWorkspace(runtimeBySlot, workspace),
                attachment,
            });
        }
        const restoredRuntime = await sessionRecovery.restoreRuntime({
            viewerId,
            slotId,
            workspace,
            threadId,
            runtimeSettings,
            recoveryContext: runtimeBySlot && runtimeBySlot.threadId === threadId
                ? {
                    trigger: 'hydrate_session',
                }
                : null,
        });
        return cloneSessionState(restoredRuntime);
    };
}
//# sourceMappingURL=chat-session-runtime-loader.js.map