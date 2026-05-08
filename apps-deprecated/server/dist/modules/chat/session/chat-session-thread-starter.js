import { createIdleSessionTurnExecution } from '@my-code-x/contracts';
import { createSessionState } from '../shared/chat-session-state.js';
import { createThreadBootstrapState } from '../thread/thread-bootstrap-policy.js';
export function createStartThreadForRuntime({ codexGateway, now, promptOverrideResolver, registry, sessionRecovery, }) {
    return async function startThreadForRuntime({ viewerId, slotId, workspace, runtime, runtimeSettings, collaborationModeKind, }) {
        const bootstrapState = await createThreadBootstrapState({
            runtimeSettings,
            promptOverrideResolver,
            includeBaseInstructions: true,
        });
        const startedThread = await codexGateway.startThread({
            workspace,
            runtimeSettings: bootstrapState.normalizedRuntimeSettings,
            baseInstructions: bootstrapState.baseInstructions,
        });
        const nextRuntime = createSessionState({
            viewerId,
            slotId,
            workspace,
            threadId: startedThread.threadId,
            turnExecution: runtime?.turnExecution ?? createIdleSessionTurnExecution(),
            collaborationModeKind: collaborationModeKind ?? runtime?.collaborationModeKind,
            appliedThreadRuntimeOverrides: runtime?.appliedThreadRuntimeOverrides,
            threadName: runtime?.threadName ?? '',
            threadStatus: runtime?.threadStatus ?? null,
            threadStatusText: runtime?.threadStatusText ?? '',
            tokenUsageText: runtime?.tokenUsageText ?? '',
            messages: runtime?.messages ?? [],
            notices: runtime?.notices ?? [],
            pendingRequests: runtime?.pendingRequests ?? [],
            lastError: runtime?.lastError ?? null,
            now,
        });
        sessionRecovery.rememberGatewayAttachment(nextRuntime);
        sessionRecovery.rememberAppliedThreadRuntimeOverrides(nextRuntime, bootstrapState.normalizedRuntimeSettings);
        registry.storeRuntime(nextRuntime);
        return nextRuntime;
    };
}
//# sourceMappingURL=chat-session-thread-starter.js.map