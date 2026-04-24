import { describe, expect, it } from 'vitest';

import {
  buildProposedPlanActionsByItemId,
  createProposedPlanActionSubmission,
  findProposedPlanActionCandidate,
} from './proposed-plan-actions';
import type { ChatTurn, SessionTimelineItem } from '../../runtime/public-types';

function turn(status: ChatTurn['status']): ChatTurn {
  return {
    id: `turn-${status}`,
    status,
    error: null,
    startedAt: null,
    completedAt: null,
    durationMs: null,
  };
}

function userMessage(id: string, turnId: string): SessionTimelineItem {
  return {
    id,
    kind: 'message',
    itemType: 'userMessage',
    role: 'user',
    text: 'Draft a plan',
    state: 'complete',
    threadId: 'thread-1',
    turnId,
  };
}

function planItem(id: string, turnId: string): SessionTimelineItem {
  return {
    id,
    kind: 'special',
    itemType: 'plan',
    text: 'Proposed plan',
    state: 'complete',
    threadId: 'thread-1',
    turnId,
    raw: { type: 'plan', id, text: 'Proposed plan' },
  };
}

describe('proposed plan actions', () => {
  it('selects only the latest plan item when the turn is terminal', () => {
    const candidate = findProposedPlanActionCandidate({
      messages: [
        userMessage('user-1', 'turn-1'),
        planItem('plan-1', 'turn-1'),
        userMessage('user-2', 'turn-2'),
        planItem('plan-2', 'turn-2'),
      ],
      latestTurn: turn('completed'),
    });

    expect(candidate).toEqual({
      itemId: 'plan-2',
      turnId: 'turn-2',
    });
  });

  it('does not create a fresh action while a turn is active or after user steering', () => {
    expect(
      findProposedPlanActionCandidate({
        messages: [planItem('plan-1', 'turn-1')],
        latestTurn: turn('inProgress'),
      }),
    ).toBeNull();

    expect(
      findProposedPlanActionCandidate({
        messages: [planItem('plan-1', 'turn-1'), userMessage('user-2', 'turn-2')],
        latestTurn: turn('completed'),
      }),
    ).toBeNull();
  });

  it('keeps resolved cards for old plans and adds one available card for the latest unresolved plan', () => {
    const actionsByItemId = buildProposedPlanActionsByItemId({
      messages: [
        userMessage('user-1', 'turn-1'),
        planItem('plan-1', 'turn-1'),
        userMessage('user-2', 'turn-2'),
        planItem('plan-2', 'turn-2'),
      ],
      latestTurn: turn('completed'),
      threadId: 'thread-1',
      canCreateAvailableAction: true,
      readDecision: ({ itemId }) => (itemId === 'plan-1' ? 'stayInPlan' : null),
    });

    expect(actionsByItemId.get('plan-1')).toEqual({
      kind: 'resolved',
      id: 'proposed-plan-action:plan-1',
      threadId: 'thread-1',
      itemId: 'plan-1',
      turnId: 'turn-1',
      decision: 'stayInPlan',
    });
    expect(actionsByItemId.get('plan-2')).toEqual({
      kind: 'available',
      id: 'proposed-plan-action:plan-2',
      threadId: 'thread-1',
      itemId: 'plan-2',
      turnId: 'turn-2',
    });
  });

  it('uses the default collaboration mode for implementation submissions', () => {
    expect(createProposedPlanActionSubmission()).toEqual({
      collaborationModeKind: 'default',
      text: 'Implement the plan.',
    });
  });
});
