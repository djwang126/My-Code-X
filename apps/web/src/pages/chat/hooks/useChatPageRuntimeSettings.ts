import { useMemo } from 'react';

import {
  normalizeRuntimeSettings,
  readRuntimeOptions,
  readRuntimeSettings,
  type RuntimeSettings,
} from '../../../features/chat/settings';
import { persistRuntimePreferences } from '../../../features/chat/settings';
import { isCurrentPageSlotOwner, SLOT_DISPLACED_MESSAGE } from '../../../features/session';
import type { Dispatch } from 'react';
import type { ChatRuntimeAction, ChatRuntimeState } from '../../../features/chat/runtime';
import type { SessionAction, SessionState as SessionShellState } from '../../../features/session';
import { prepareRuntimeSettingsUpdate } from '../state/runtime-settings-update';

type UseChatPageRuntimeSettingsInput = {
  sessionState: SessionShellState;
  chatState: ChatRuntimeState;
  chatDispatch: Dispatch<ChatRuntimeAction>;
  sessionDispatch: Dispatch<SessionAction>;
};

export function useChatPageRuntimeSettings({
  sessionState,
  chatState,
  chatDispatch,
  sessionDispatch,
}: UseChatPageRuntimeSettingsInput) {
  const runtimeSettings = useMemo(() => readRuntimeSettings(chatState.preferences), [chatState.preferences]);
  const runtimeOptions = useMemo(() => readRuntimeOptions(chatState.options), [chatState.options]);

  function handleRuntimeSettingsChange(nextRuntimeSettings: RuntimeSettings) {
    if (!isCurrentPageSlotOwner(sessionState.slotId)) {
      sessionDispatch({
        type: 'slot/displaced',
        viewerId: sessionState.viewerId,
        slotId: sessionState.slotId,
        errorMessage: SLOT_DISPLACED_MESSAGE,
      });
      return;
    }

    const normalizedRuntimeSettings = normalizeRuntimeSettings(nextRuntimeSettings);
    const update = prepareRuntimeSettingsUpdate({
      slotId: sessionState.slotId,
      nextRuntimeSettings: normalizedRuntimeSettings,
    });

    chatDispatch({ type: 'preferences/updated', preferences: update.preferences });

    if (update.persistSlotId) {
      persistRuntimePreferences(update.persistSlotId, update.preferences);
    }
  }

  return {
    runtimeSettings,
    runtimeOptions,
    handleRuntimeSettingsChange,
  };
}
