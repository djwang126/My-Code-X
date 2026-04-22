import type { RuntimeOptions, RuntimePreferences } from '../../common/codex/codex-types.js';
import type { ChatSessionState } from '../chat/shared/chat-types.js';
import { createSessionBootstrapPayload } from './session.contract.js';

interface SessionServiceDependencies {
  serverInstanceId: string;
  authRequired: boolean;
  chatService: {
    hydrateSession(input: {
      viewerId: string;
      slotId: string;
      workspace?: string;
      threadId?: string;
    }): Promise<ChatSessionState>;
    getPreferences?: () => RuntimePreferences;
    getOptions?: () => RuntimeOptions;
  };
}

export function createSessionService({ serverInstanceId, authRequired, chatService }: SessionServiceDependencies) {
  return {
    async getSessionBootstrap({
      viewerId,
      slotId,
      workspace,
      threadId,
    }: {
      viewerId: string;
      slotId: string;
      workspace?: string;
      threadId?: string;
    }) {
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
