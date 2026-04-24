import { DEFAULT_COLLABORATION_MODE_KIND } from '../../../../shared/lib/collaboration-mode';
import { isChatTurnActive } from '@my-code-x/contracts';

import type { ChatTurn, SessionTimelineItem } from '../../runtime/public-types';

export const PROPOSED_PLAN_ACTION_MESSAGE = 'Implement the plan.';

export type ProposedPlanActionCandidate = {
  itemId: string;
  turnId: string;
};

export type ProposedPlanActionDecision = 'implement' | 'stayInPlan';

export type ProposedPlanTranscriptAction =
  | {
      kind: 'available';
      id: string;
      threadId: string;
      itemId: string;
      turnId: string;
    }
  | {
      kind: 'resolved';
      id: string;
      threadId: string;
      itemId: string;
      turnId: string;
      decision: ProposedPlanActionDecision;
    };

type FindProposedPlanActionCandidateInput = {
  messages: SessionTimelineItem[];
  latestTurn: ChatTurn | null;
};

type BuildProposedPlanActionsByItemIdInput = {
  messages: SessionTimelineItem[];
  latestTurn: ChatTurn | null;
  threadId: string;
  canCreateAvailableAction: boolean;
  readDecision: (input: ProposedPlanActionKeyInput) => ProposedPlanActionDecision | null;
};

export type ProposedPlanActionKeyInput = {
  threadId: string;
  itemId: string;
};

type ProposedPlanTimelineItem = Extract<SessionTimelineItem, { kind: 'special' }> & {
  turnId: string;
};

export function createProposedPlanActionId(itemId: string) {
  return `proposed-plan-action:${itemId}`;
}

export function isProposedPlanTimelineItem(message: SessionTimelineItem): message is ProposedPlanTimelineItem {
  return (
    message.kind === 'special' &&
    message.itemType === 'plan' &&
    message.state !== 'error' &&
    typeof message.turnId === 'string' &&
    Boolean(message.turnId)
  );
}

function isUserSteer(message: SessionTimelineItem) {
  return message.kind === 'message' && message.role === 'user';
}

export function findProposedPlanActionCandidate({
  messages,
  latestTurn,
}: FindProposedPlanActionCandidateInput): ProposedPlanActionCandidate | null {
  if (isChatTurnActive(latestTurn)) {
    return null;
  }

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];

    if (isUserSteer(message)) {
      return null;
    }

    if (isProposedPlanTimelineItem(message)) {
      return {
        itemId: message.id,
        turnId: message.turnId,
      };
    }
  }

  return null;
}

export function buildProposedPlanActionsByItemId({
  messages,
  latestTurn,
  threadId,
  canCreateAvailableAction,
  readDecision,
}: BuildProposedPlanActionsByItemIdInput) {
  const actionsByItemId = new Map<string, ProposedPlanTranscriptAction>();

  if (!threadId) {
    return actionsByItemId;
  }

  for (const message of messages) {
    if (!isProposedPlanTimelineItem(message)) {
      continue;
    }

    const decision = readDecision({ threadId, itemId: message.id });
    if (!decision) {
      continue;
    }

    actionsByItemId.set(message.id, {
      kind: 'resolved',
      id: createProposedPlanActionId(message.id),
      threadId,
      itemId: message.id,
      turnId: message.turnId,
      decision,
    });
  }

  if (!canCreateAvailableAction) {
    return actionsByItemId;
  }

  const candidate = findProposedPlanActionCandidate({ messages, latestTurn });
  if (candidate && !actionsByItemId.has(candidate.itemId)) {
    actionsByItemId.set(candidate.itemId, {
      kind: 'available',
      id: createProposedPlanActionId(candidate.itemId),
      threadId,
      itemId: candidate.itemId,
      turnId: candidate.turnId,
    });
  }

  return actionsByItemId;
}

export function createProposedPlanActionSubmission() {
  return {
    collaborationModeKind: DEFAULT_COLLABORATION_MODE_KIND,
    text: PROPOSED_PLAN_ACTION_MESSAGE,
  };
}
