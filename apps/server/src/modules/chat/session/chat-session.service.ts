import { createChatSessionRecovery } from './chat-session-recovery.js';
import { createHydrateSession } from './chat-session-runtime-loader.js';
import { createGetOrCreateRuntimeForSend } from './chat-session-send-runtime-resolver.js';
import { createStartThreadForRuntime } from './chat-session-thread-starter.js';
export function createChatSessionService({ codexGateway, promptOverrideResolver, now, registry, attachmentService, logger }: any) {
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
        getOrCreateRuntimeForSend,
        hydrateSession,
        startThreadForRuntime,
        getRuntimeAttachment: sessionRecovery.getRuntimeAttachment,
        logRuntimeRecovery: sessionRecovery.logRuntimeRecovery,
        restoreRuntime: sessionRecovery.restoreRuntime,
        storeRuntimeFromResult: sessionRecovery.storeRuntimeFromResult,
    };
}
