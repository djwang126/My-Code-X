import { persistSessionStorageValue, readSessionStorageValue } from '../../../../shared/lib/browser-storage';
import type { ProposedPlanActionDecision, ProposedPlanActionKeyInput } from './proposed-plan-actions';

const proposedPlanActionStoragePrefix = 'my-code-x-proposed-plan-action:';

interface RecordProposedPlanActionDecisionInput extends ProposedPlanActionKeyInput {
  decision: ProposedPlanActionDecision;
}

function createProposedPlanActionStorageKey({ threadId, itemId }: ProposedPlanActionKeyInput) {
  return `${proposedPlanActionStoragePrefix}${threadId}:${itemId}`;
}

export function recordProposedPlanActionDecision({
  threadId,
  itemId,
  decision,
}: RecordProposedPlanActionDecisionInput) {
  if (!threadId || !itemId) {
    return;
  }

  persistSessionStorageValue(
    createProposedPlanActionStorageKey({ threadId, itemId }),
    JSON.stringify({ decision }),
  );
}

export function readProposedPlanActionDecision({
  threadId,
  itemId,
}: ProposedPlanActionKeyInput): ProposedPlanActionDecision | null {
  if (!threadId || !itemId) {
    return null;
  }

  const rawValue = readSessionStorageValue(createProposedPlanActionStorageKey({ threadId, itemId }));
  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as { decision?: unknown };
    return parsed.decision === 'implement' || parsed.decision === 'stayInPlan' ? parsed.decision : null;
  } catch {
    return null;
  }
}
