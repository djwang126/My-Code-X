import { useMemo } from 'react';

import {
  DEFAULT_COLLABORATION_MODE_KIND,
  cycleCollaborationModeKind,
  findCollaborationModeOption,
  normalizeCollaborationModeKind,
} from '../../../../shared/lib/collaboration-mode';
import { getCollaborationModeOptions, normalizeRuntimeSettings, readRuntimeOptions, readRuntimeSettings } from '../../settings';
import type { ChatRuntimeState } from '../state/chat-runtime-state';
import type { RuntimeSettings } from '../../settings';
import { isChatTurnStateActive } from '../state/chat-turn-state';

export function useCollaborationModeController({
  state,
  onRuntimeSettingsChange,
}: {
  state: ChatRuntimeState;
  onRuntimeSettingsChange: (runtimeSettings: RuntimeSettings) => void;
}) {
  const runtimeSettings = useMemo(() => readRuntimeSettings(state.preferences), [state.preferences]);
  const runtimeOptions = useMemo(() => readRuntimeOptions(state.options), [state.options]);
  const collaborationModeOptions = useMemo(
    () => (runtimeSettings && runtimeOptions ? getCollaborationModeOptions(runtimeOptions, runtimeSettings) : []),
    [runtimeOptions, runtimeSettings],
  );
  const collaborationModeKind = runtimeSettings?.collaborationModeKind ?? null;
  const collaborationModeLabel =
    (collaborationModeKind ? findCollaborationModeOption(collaborationModeOptions, collaborationModeKind)?.label : null) ??
    'None';
  const canCycleCollaborationMode = collaborationModeOptions.length > 0;

  async function selectCollaborationMode(collaborationModeKind: string | null) {
    if (!runtimeSettings) {
      return false;
    }

    onRuntimeSettingsChange(
      normalizeRuntimeSettings({
        ...runtimeSettings,
        collaborationModeKind: collaborationModeKind ? normalizeCollaborationModeKind(collaborationModeKind) : null,
      }),
    );
    return true;
  }

  async function handleCycleCollaborationMode() {
    if (isChatTurnStateActive(state.latestTurn)) {
      return false;
    }

    const nextCollaborationModeKind = cycleCollaborationModeKind(
      collaborationModeOptions,
      collaborationModeKind ?? DEFAULT_COLLABORATION_MODE_KIND,
    );
    return selectCollaborationMode(nextCollaborationModeKind);
  }

  return {
    canCycleCollaborationMode,
    collaborationModeLabel,
    collaborationModeOptions,
    handleCycleCollaborationMode,
  };
}
