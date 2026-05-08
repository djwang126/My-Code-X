import { createSessionBootstrapPayload } from './session.contract.js';
export function createSessionService({ serverInstanceId, authRequired, chatService }) {
    return {
        async getSessionBootstrap({ viewerId, slotId, workspace, threadId, }) {
            const sessionState = await chatService.hydrateSession({ viewerId, slotId, workspace, threadId });
            const preferences = typeof chatService.getPreferences === 'function' ? chatService.getPreferences() : {};
            const options = typeof chatService.getOptions === 'function' ? chatService.getOptions() : {};
            return createSessionBootstrapPayload({
                viewerId,
                slotId,
                sessionState,
                serverInstanceId,
                authRequired,
                preferences,
                options,
            });
        },
    };
}
//# sourceMappingURL=session.service.js.map