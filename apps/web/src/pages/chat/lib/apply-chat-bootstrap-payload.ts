import { resolveBootstrapCollaborationModeKind } from '../../../shared/lib/collaboration-mode';
import {
  applySessionRuntimeMetadata,
  loadStoredRuntimePreferences,
  mergeRuntimeSettings,
  persistRuntimePreferences,
  readRuntimeSettings,
} from '../../../features/chat/settings';
import {
  type SessionPayload,
} from '../../../features/chat/runtime';

type SessionSelectionInput = {
  workspace: string;
  threadId: string;
};

type SessionBootstrapSucceededInput = {
  viewerId: string;
  slotId: string;
  workspace: string;
  threadId: string;
  serverInstanceId: string;
};

type ApplyChatBootstrapPayloadInput = {
  payload: SessionPayload;
  selectThread: (input: SessionSelectionInput) => void;
  dispatchSessionBootstrapSucceeded: (input: SessionBootstrapSucceededInput) => void;
  dispatchChatBootstrapSucceeded: (payload: SessionPayload) => void;
};

export function applyChatBootstrapPayload({
  payload,
  selectThread,
  dispatchSessionBootstrapSucceeded,
  dispatchChatBootstrapSucceeded,
}: ApplyChatBootstrapPayloadInput) {
  const slotId = payload.viewer.slotId;
  const storedRuntimePreferences = loadStoredRuntimePreferences(slotId);
  const mergedRuntimeSettings = mergeRuntimeSettings({
    defaults: readRuntimeSettings(payload.preferences),
    stored: storedRuntimePreferences,
  });
  const nextCollaborationModeKind = resolveBootstrapCollaborationModeKind({
    threadId: payload.session.threadId,
    payloadKind: payload.session.collaborationModeKind,
    storedKind: storedRuntimePreferences?.collaborationModeKind,
  });
  const nextRuntimeSettings = applySessionRuntimeMetadata(mergedRuntimeSettings, {
    collaborationModeKind: nextCollaborationModeKind,
    ...(Object.prototype.hasOwnProperty.call(payload.session, 'promptOverride')
      ? { promptOverride: payload.session.promptOverride }
      : {}),
  });
  const nextPayload = nextRuntimeSettings
    ? {
        ...payload,
        preferences: nextRuntimeSettings,
      }
    : payload;

  if (nextRuntimeSettings) {
    persistRuntimePreferences(slotId, nextRuntimeSettings);
  }

  selectThread({
    workspace: payload.session.workspace,
    threadId: payload.session.threadId,
  });
  dispatchSessionBootstrapSucceeded({
    viewerId: payload.viewer.viewerId,
    slotId,
    workspace: payload.session.workspace,
    threadId: payload.session.threadId,
    serverInstanceId: payload.server.serverInstanceId,
  });
  dispatchChatBootstrapSucceeded(nextPayload);
}
