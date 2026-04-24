import {
  DEFAULT_COLLABORATION_MODE_KIND,
  readOptionalCollaborationModeKind,
} from '../../../../shared/lib/collaboration-mode';
import { isChatTurnActive } from '@my-code-x/contracts';

import type { ChatTurn, SessionTimelineItem } from '../../runtime/public-types';

export const PROPOSED_PLAN_ACTION_MESSAGE = 'Implement the plan.';

export type ProposedPlanActionCandidate = {
  turnId: string;
};

type FindProposedPlanActionCandidateInput = {
  messages: SessionTimelineItem[];
  collaborationModeKind: string;
  latestTurn: ChatTurn | null;
};

export function findProposedPlanActionCandidate({
  messages,
  collaborationModeKind,
  latestTurn,
}: FindProposedPlanActionCandidateInput): ProposedPlanActionCandidate | null {
  if (isChatTurnActive(latestTurn)) {
    return null;
  }

  if (readOptionalCollaborationModeKind(collaborationModeKind) !== 'plan') {
    return null;
  }

  let latestUserTurnId: string | null = null;

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    const turnId = typeof message.turnId === 'string' && message.turnId ? message.turnId : null;

    if (!turnId) {
      continue;
    }

    if (message.kind === 'message' && message.role === 'user') {
      latestUserTurnId = latestUserTurnId ?? turnId;
      continue;
    }

    if (message.kind === 'special' && message.itemType === 'plan' && message.state !== 'error') {
      if (latestUserTurnId && latestUserTurnId !== turnId) {
        return null;
      }

      return { turnId };
    }
  }

  return null;
}

export function createProposedPlanActionSubmission() {
  return {
    collaborationModeKind: DEFAULT_COLLABORATION_MODE_KIND,
    text: PROPOSED_PLAN_ACTION_MESSAGE,
  };
}

