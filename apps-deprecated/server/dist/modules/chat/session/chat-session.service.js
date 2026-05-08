import { createChatSessionRecovery } from './chat-session-recovery.js';
import { createEnsureLoadedThreadRuntime, createHydrateSession } from './chat-session-runtime-loader.js';
import { createGetOrCreateRuntimeForSend } from './chat-session-send-runtime-resolver.js';
import { createStartThreadForRuntime } from './chat-session-thread-starter.js';
export function createChatSessionService({ codexGateway, promptOverrideResolver, now, registry, attachmentService, logger }) {
    const sessionRecovery = createChatSessionRecovery({
        attachmentService,
        codexGateway,
        logger,
        now,
        promptOverrideResolver,
        registry,
    });
    const startThreadForRuntime = createStartThreadForRuntime({
        codexGateway,
        now,
        promptOverrideResolver,
        registry,
        sessionRecovery,
    });
    const ensureLoadedThreadRuntime = createEnsureLoadedThreadRuntime({
        registry,
        sessionRecovery,
    });
    const getOrCreateRuntimeForSend = createGetOrCreateRuntimeForSend({
        promptOverrideResolver,
        registry,
        sessionRecovery,
        startThreadForRuntime,
    });
    const hydrateSession = createHydrateSession({
        now,
        registry,
        sessionRecovery,
    });
    return {
        ensureLoadedThreadRuntime,
        getOrCreateRuntimeForSend,
        hydrateSession,
        restoreRuntime: sessionRecovery.restoreRuntime,
    };
}
//# sourceMappingURL=chat-session.service.js.map