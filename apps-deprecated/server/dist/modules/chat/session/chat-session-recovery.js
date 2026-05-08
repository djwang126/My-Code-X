import { parseSessionTurnExecution } from '@my-code-x/contracts';
import { createSessionState } from '../shared/chat-session-state.js';
import { createThreadBootstrapState, readAppliedThreadRuntimeOverrides, } from '../thread/thread-bootstrap-policy.js';
function createSessionLogger(logger) {
    return {
        info: typeof logger?.info === 'function' ? logger.info.bind(logger) : () => { },
    };
}
export function createChatSessionRecovery({ attachmentService, codexGateway, logger, now, promptOverrideResolver, registry, }) {
    const sessionLogger = createSessionLogger(logger);
    function rememberAppliedThreadRuntimeOverrides(runtime, runtimeSettings) {
        runtime.appliedThreadRuntimeOverrides = readAppliedThreadRuntimeOverrides(runtimeSettings);
        return runtime;
    }
    function readGatewayGeneration() {
        return typeof codexGateway.getGatewayGeneration === 'function' ? codexGateway.getGatewayGeneration() : null;
    }
    function rememberGatewayAttachment(runtime) {
        const gatewayGeneration = readGatewayGeneration();
        if (gatewayGeneration === null) {
            delete runtime.gatewayGeneration;
            return runtime;
        }
        runtime.gatewayGeneration = gatewayGeneration;
        return runtime;
    }
    function getRuntimeAttachment(runtime) {
        if (!runtime?.threadId) {
            return {
                attached: false,
                reason: 'missing_thread',
                runtimeGatewayGeneration: runtime?.gatewayGeneration ?? null,
                currentGatewayGeneration: readGatewayGeneration(),
            };
        }
        const hasGenerationReader = typeof codexGateway.getGatewayGeneration === 'function';
        const hasActiveGatewayReader = typeof codexGateway.hasActiveGateway === 'function';
        const currentGatewayGeneration = readGatewayGeneration();
        const runtimeGatewayGeneration = runtime.gatewayGeneration ?? null;
        if (!hasGenerationReader && !hasActiveGatewayReader) {
            return {
                attached: true,
                reason: 'gateway_status_unavailable',
                runtimeGatewayGeneration,
                currentGatewayGeneration,
            };
        }
        if (hasActiveGatewayReader && !codexGateway.hasActiveGateway()) {
            return {
                attached: false,
                reason: 'gateway_inactive',
                runtimeGatewayGeneration,
                currentGatewayGeneration,
            };
        }
        if (!hasGenerationReader) {
            return {
                attached: true,
                reason: 'gateway_generation_unavailable',
                runtimeGatewayGeneration,
                currentGatewayGeneration,
            };
        }
        if (runtime.gatewayGeneration !== currentGatewayGeneration) {
            return {
                attached: false,
                reason: 'gateway_generation_mismatch',
                runtimeGatewayGeneration,
                currentGatewayGeneration,
            };
        }
        return {
            attached: true,
            reason: 'attached',
            runtimeGatewayGeneration,
            currentGatewayGeneration,
        };
    }
    function logRuntimeRecovery({ trigger, slotId, threadId, workspace, attachment }) {
        if (attachment?.attached) {
            return;
        }
        sessionLogger.info(`[chat-session-service] restoring stale runtime (${trigger}) for slot=${slotId} thread=${threadId} workspace=${workspace || ''} reason=${attachment.reason} runtimeGeneration=${attachment.runtimeGatewayGeneration ?? 'none'} currentGeneration=${attachment.currentGatewayGeneration ?? 'none'}`);
    }
    function logRuntimeRestored({ trigger, runtime, workspace }) {
        sessionLogger.info(`[chat-session-service] restored runtime (${trigger}) for slot=${runtime.slotId} thread=${runtime.threadId} workspace=${workspace || ''} gatewayGeneration=${runtime.gatewayGeneration ?? 'none'}`);
    }
    async function restoreRuntime({ viewerId, slotId, workspace, threadId, runtimeSettings, recoveryContext = null, }) {
        const conflictingRuntime = registry.getConflictingThreadRuntime({ slotId, threadId });
        const bootstrapState = await createThreadBootstrapState({
            runtimeSettings: conflictingRuntime?.appliedThreadRuntimeOverrides ?? runtimeSettings,
            promptOverrideResolver,
            includeBaseInstructions: true,
        });
        const resumeResult = await codexGateway.resumeThread({
            threadId,
            workspace,
            runtimeSettings: bootstrapState.normalizedRuntimeSettings,
            baseInstructions: bootstrapState.baseInstructions,
        });
        const restoredMessages = typeof attachmentService?.hydrateTimelineItems === 'function'
            ? await attachmentService.hydrateTimelineItems(resumeResult.messages || [], { slotId, threadId })
            : (resumeResult.messages || []);
        const runtime = createSessionState({
            viewerId,
            slotId,
            workspace,
            threadId,
            turnExecution: parseSessionTurnExecution(resumeResult.turnExecution, {
                fieldName: 'resumeResult.turnExecution',
            }),
            collaborationModeKind: resumeResult.collaborationModeKind,
            appliedThreadRuntimeOverrides: conflictingRuntime?.appliedThreadRuntimeOverrides,
            threadName: resumeResult.threadName ?? '',
            threadStatus: resumeResult.threadStatus ?? null,
            threadStatusText: resumeResult.threadStatusText ?? '',
            tokenUsageText: resumeResult.tokenUsageText ?? '',
            messages: restoredMessages,
            notices: resumeResult.notices || [],
            pendingRequests: resumeResult.pendingRequests || [],
            lastError: resumeResult.lastError || null,
            now,
        });
        registry.rebindThreadlessPendingRequests(conflictingRuntime, runtime);
        rememberGatewayAttachment(runtime);
        rememberAppliedThreadRuntimeOverrides(runtime, bootstrapState.normalizedRuntimeSettings);
        registry.releaseRuntimeOwnership(conflictingRuntime);
        registry.storeRuntime(runtime);
        if (recoveryContext) {
            logRuntimeRestored({
                trigger: recoveryContext.trigger,
                runtime,
                workspace,
            });
        }
        return runtime;
    }
    return {
        getRuntimeAttachment,
        logRuntimeRecovery,
        rememberAppliedThreadRuntimeOverrides,
        rememberGatewayAttachment,
        restoreRuntime,
    };
}
//# sourceMappingURL=chat-session-recovery.js.map