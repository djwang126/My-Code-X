import { useMemo, useState } from 'react';

import { DEFAULT_COLLABORATION_MODE_KIND, normalizeCollaborationModeKind } from '../../../../shared/lib/collaboration-mode';
import {
  createProposedPlanActionSubmission,
  recordProposedPlanActionDecision,
  type ProposedPlanTranscriptAction,
} from '../../commands';
import { normalizeRuntimeSettings, readRuntimeSettings, type RuntimeSettings } from '../../settings';
import type { ChatRuntimeState } from '../state/chat-runtime-state';
import type { SessionSendInput } from '../session-types';

interface UseProposedPlanActionControllerInput {
  state: ChatRuntimeState;
  sendMessage: (input: SessionSendInput, options?: { collaborationModeKind?: string }) => Promise<boolean>;
  onRuntimeSettingsChange: (runtimeSettings: RuntimeSettings) => void;
}

interface RecordDecisionInput {
  action: ProposedPlanTranscriptAction & { kind: 'available' };
  decision: 'implement' | 'stayInPlan';
}

function isAvailableProposedPlanAction(
  action: ProposedPlanTranscriptAction,
): action is ProposedPlanTranscriptAction & { kind: 'available' } {
  return action.kind === 'available';
}

export function useProposedPlanActionController({
  state,
  sendMessage,
  onRuntimeSettingsChange,
}: UseProposedPlanActionControllerInput) {
  const [revision, setRevision] = useState(0);
  const runtimeSettings = useMemo(() => readRuntimeSettings(state.preferences), [state.preferences]);

  function recordDecision({ action, decision }: RecordDecisionInput) {
    recordProposedPlanActionDecision({
      threadId: action.threadId,
      itemId: action.itemId,
      decision,
    });
    setRevision(currentRevision => currentRevision + 1);
  }

  async function selectDefaultCollaborationMode() {
    if (!runtimeSettings) {
      return false;
    }

    onRuntimeSettingsChange(
      normalizeRuntimeSettings({
        ...runtimeSettings,
        collaborationModeKind: normalizeCollaborationModeKind(DEFAULT_COLLABORATION_MODE_KIND),
      }),
    );
    return true;
  }

  async function handleConfirmProposedPlanAction(action: ProposedPlanTranscriptAction) {
    if (!isAvailableProposedPlanAction(action)) {
      return false;
    }

    const submission = createProposedPlanActionSubmission();
    const submitted = await sendMessage(
      { text: submission.text },
      { collaborationModeKind: submission.collaborationModeKind },
    );

    if (!submitted) {
      return false;
    }

    recordDecision({ action, decision: 'implement' });
    await selectDefaultCollaborationMode();
    return true;
  }

  async function handleDismissProposedPlanAction(action: ProposedPlanTranscriptAction) {
    if (!isAvailableProposedPlanAction(action)) {
      return false;
    }

    recordDecision({ action, decision: 'stayInPlan' });
    return true;
  }

  return {
    handleConfirmProposedPlanAction,
    handleDismissProposedPlanAction,
    proposedPlanActionRevision: revision,
  };
}
