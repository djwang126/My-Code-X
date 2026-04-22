import { useMemo } from 'react';

import {
  normalizeRuntimeSettings,
  readRuntimeOptions,
  readRuntimeSettings,
  type RuntimeSettings,
} from '../../runtime-settings';
import { persistRuntimePreferences } from '../../runtime-settings';
import { isCurrentPageSlotOwner, SLOT_DISPLACED_MESSAGE } from '../../session';
import type { ChatRuntimeAction, ChatRuntimeState } from '../../chat-runtime/public-types';
import type { SessionAction, SessionState as SessionShellState } from '../../session/public-types';
import type { Dispatch } from 'react';
import { prepareRuntimeSettingsUpdate } from '../state/chat-page-runtime-settings-update';

export function useChatPageRuntimeSettings({
  sessionState,
  chatState,
  chatDispatch,
  sessionDispatch,
}: {
  sessionState: SessionShellState;
  chatState: ChatRuntimeState;
  chatDispatch: Dispatch<ChatRuntimeAction>;
  sessionDispatch: Dispatch<SessionAction>;
}) {
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
