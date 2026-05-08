import { cloneSessionState, createSessionState } from './shared/chat-session-state.js';
import { createSessionRegistry } from './shared/chat-session-registry.js';
import { createChatEventBus } from './shared/chat-session-event-bus.js';
import { createChatSessionService } from './session/chat-session.service.js';
import { createChatMessageService } from './message/chat-message.service.js';
import { createThreadActionsService } from './thread/thread-actions.service.js';
import { createPendingRequestService } from './pending-request/pending-request.service.js';
import { createItemContentService } from './item-content/item-content.service.js';
import { createChatEventApplier } from './events/chat-event-applier.js';
import { createAttachmentService } from './attachments/attachment.service.js';
import { createAttachmentRetentionService } from './attachments/attachment-retention.service.js';
import { createIdleSessionTurnExecution } from '@my-code-x/contracts';
function createDefaultGateway() {
    return {
        async close() { },
        setNotificationHandler() { },
    };
}
function createLogger(logger) {
    const fallbackLogger = {
        info: () => { },
        warn: () => { },
        error: () => { },
    };
    if (logger) {
        return {
            ...fallbackLogger,
            ...logger,
        };
    }
    return fallbackLogger;
}
export function createUnconfiguredChatService({ now = () => new Date().toISOString() } = {}) {
    return {
        async hydrateSession({ viewerId, slotId, workspace = '', threadId = '' }) {
            return createSessionState({
                viewerId,
                slotId,
                workspace,
                threadId,
                turnExecution: createIdleSessionTurnExecution(),
                now,
            });
        },
        getPreferences() {
            return {};
        },
        getOptions() {
            return {};
        },
        async sendMessage() {
            throw new Error('chat service sendMessage is not configured');
        },
        async uploadAttachment() {
            throw new Error('chat service uploadAttachment is not configured');
        },
        async getAttachmentContent() {
            throw new Error('chat service getAttachmentContent is not configured');
        },
        async interruptTurn() {
            throw new Error('chat service interruptTurn is not configured');
        },
        async compactThread() {
            throw new Error('chat service compactThread is not configured');
        },
        async rollbackThread() {
            throw new Error('chat service rollbackThread is not configured');
        },
        async forkThread() {
            throw new Error('chat service forkThread is not configured');
        },
        async startReview() {
            throw new Error('chat service startReview is not configured');
        },
        async listThreadHistory() {
            throw new Error('chat service thread history is not configured');
        },
        async respondToPendingRequest() {
            throw new Error('chat service request responses are not configured');
        },
        async getTimelineItemContent() {
            throw new Error('chat service timeline item content is not configured');
        },
        applyGatewayEvent() { },
        getSessionState() {
            return null;
        },
        getCodexActivitySnapshot() {
            return { sessions: [] };
        },
        subscribe() {
            return () => { };
        },
    };
}
export function createChatService({ codexGateway: codexGatewayOverrides = createDefaultGateway(), promptOverrideResolver = null, now = () => new Date().toISOString(), logger, attachmentService: injectedAttachmentService = null, attachmentRetentionService: injectedAttachmentRetentionService = null, } = {}) {
    const codexGateway = {
        ...createDefaultGateway(),
        ...codexGatewayOverrides,
    };
    const serviceLogger = createLogger(logger);
    const registry = createSessionRegistry();
    const emitter = createChatEventBus();
    const nowAsDate = () => new Date(now());
    const attachmentService = (injectedAttachmentService ?? createAttachmentService({ now: nowAsDate, logger: serviceLogger }));
    if (!injectedAttachmentService) {
        attachmentService.setSessionRuntimeResolver((selection) => registry.getRuntimeForSelection(selection));
    }
    const attachmentRetentionService = (injectedAttachmentRetentionService ??
        (attachmentService?.metadataStore
            ? createAttachmentRetentionService({
                metadataStore: attachmentService.metadataStore,
                now: nowAsDate,
                logger: serviceLogger,
            })
            : null));
    const sessionService = createChatSessionService({
        codexGateway,
        promptOverrideResolver,
        now,
        registry,
        attachmentService,
        logger: serviceLogger,
    });
    const sendMessageService = createChatMessageService({
        codexGateway,
        now,
        logger: serviceLogger,
        registry,
        emitter,
        sessionService,
        attachmentService,
    });
    const threadActionsService = createThreadActionsService({
        codexGateway,
        promptOverrideResolver,
        registry,
        sessionService,
    });
    const pendingRequestsService = createPendingRequestService({
        codexGateway,
        now,
        registry,
        emitter,
    });
    const itemContentService = createItemContentService({ registry });
    const eventApplier = createChatEventApplier({ now, registry, emitter });
    let attachmentMaintenancePending = false;
    function scheduleAttachmentMaintenance(reason) {
        if (!attachmentRetentionService || attachmentMaintenancePending) {
            return;
        }
        attachmentMaintenancePending = true;
        queueMicrotask(async () => {
            try {
                await attachmentRetentionService.pruneExpiredAttachments();
            }
            catch (error) {
                serviceLogger.warn?.(`[chat-service] attachment maintenance failed after ${reason}: ${error instanceof Error ? error.message : String(error)}`);
            }
            finally {
                attachmentMaintenancePending = false;
            }
        });
    }
    scheduleAttachmentMaintenance('startup');
    return {
        hydrateSession: sessionService.hydrateSession,
        getPreferences() {
            return typeof codexGateway.getPreferences === 'function' ? codexGateway.getPreferences() : {};
        },
        getOptions() {
            return typeof codexGateway.getOptions === 'function' ? codexGateway.getOptions() : {};
        },
        sendMessage: sendMessageService.sendMessage,
        async uploadAttachment(input) {
            const result = await attachmentService.uploadAttachment(input);
            scheduleAttachmentMaintenance('upload');
            return result;
        },
        getAttachmentContent: attachmentService.getAttachmentContent,
        interruptTurn: threadActionsService.interruptTurn,
        compactThread: threadActionsService.compactThread,
        rollbackThread: threadActionsService.rollbackThread,
        forkThread: threadActionsService.forkThread,
        startReview: threadActionsService.startReview,
        listThreadHistory: threadActionsService.listThreadHistory,
        respondToPendingRequest: pendingRequestsService.respondToPendingRequest,
        getTimelineItemContent: itemContentService.getTimelineItemContent,
        applyGatewayEvent: eventApplier.applyGatewayEvent,
        getSessionState({ slotId, threadId }) {
            const sessionState = registry.getRuntimeForSelection({ slotId, threadId });
            return sessionState ? cloneSessionState(sessionState) : null;
        },
        getCodexActivitySnapshot() {
            return {
                sessions: registry.listRuntimes().map((runtime) => ({
                    slotId: runtime.slotId,
                    threadId: runtime.threadId,
                    turnExecution: runtime.turnExecution,
                    pendingRequestCount: runtime.pendingRequests.length,
                })),
            };
        },
        subscribe: emitter.subscribe,
    };
}
//# sourceMappingURL=chat.service.js.map