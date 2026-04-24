import { afterEach, describe, expect, it } from 'vitest';

import {
  readProposedPlanActionDecision,
  recordProposedPlanActionDecision,
} from './proposed-plan-action-storage';

afterEach(() => {
  window.sessionStorage.clear();
});

describe('proposed plan action storage', () => {
  it('records and reads a decision by thread and item', () => {
    recordProposedPlanActionDecision({
      threadId: 'thread-1',
      itemId: 'plan-1',
      decision: 'implement',
    });

    expect(
      readProposedPlanActionDecision({
        threadId: 'thread-1',
        itemId: 'plan-1',
      }),
    ).toBe('implement');
  });

  it('does not read decisions across thread boundaries', () => {
    recordProposedPlanActionDecision({
      threadId: 'thread-1',
      itemId: 'plan-1',
      decision: 'stayInPlan',
    });

    expect(
      readProposedPlanActionDecision({
        threadId: 'thread-2',
        itemId: 'plan-1',
      }),
    ).toBeNull();
  });

  it('ignores malformed or unsupported stored values', () => {
    window.sessionStorage.setItem('my-code-x-proposed-plan-action:thread-1:plan-1', '{');
    window.sessionStorage.setItem(
      'my-code-x-proposed-plan-action:thread-1:plan-2',
      JSON.stringify({ decision: 'maybe' }),
    );

    expect(
      readProposedPlanActionDecision({
        threadId: 'thread-1',
        itemId: 'plan-1',
      }),
    ).toBeNull();
    expect(
      readProposedPlanActionDecision({
        threadId: 'thread-1',
        itemId: 'plan-2',
      }),
    ).toBeNull();
  });
});
