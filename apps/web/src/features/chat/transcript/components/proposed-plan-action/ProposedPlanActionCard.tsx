import { useState } from 'react';

import type { ProposedPlanTranscriptAction } from '../../../commands';
import type { ProposedPlanActionHandler } from '../../types';
import { InlineActionButton } from '../inline-action-card/InlineActionButton';
import { InlineActionFrame } from '../inline-action-card/InlineActionFrame';

interface ProposedPlanActionCardProps {
  action: ProposedPlanTranscriptAction;
  onConfirmProposedPlanAction?: ProposedPlanActionHandler;
  onDismissProposedPlanAction?: ProposedPlanActionHandler;
}

function readResolvedCopy(action: ProposedPlanTranscriptAction) {
  if (action.kind !== 'resolved') {
    return null;
  }

  if (action.decision === 'implement') {
    return {
      badge: 'Submitted',
      title: 'Plan implementation requested',
      prompt: 'Sent `Implement the plan.` in Default mode.',
    };
  }

  return {
    badge: 'Kept',
    title: 'Stayed in Plan mode',
    prompt: 'No implementation turn was started from this plan.',
  };
}

export function ProposedPlanActionCard({
  action,
  onConfirmProposedPlanAction,
  onDismissProposedPlanAction,
}: ProposedPlanActionCardProps) {
  const [submittingDecision, setSubmittingDecision] = useState<'implement' | 'stayInPlan' | null>(null);
  const resolvedCopy = readResolvedCopy(action);

  async function runAction(decision: 'implement' | 'stayInPlan') {
    const handler = decision === 'implement' ? onConfirmProposedPlanAction : onDismissProposedPlanAction;
    if (!handler || action.kind !== 'available') {
      return;
    }

    setSubmittingDecision(decision);
    const ok = await handler(action);
    if (!ok) {
      setSubmittingDecision(null);
    }
  }

  if (resolvedCopy) {
    return (
      <InlineActionFrame
        ariaLabel="proposed plan action"
        badge={resolvedCopy.badge}
        className="proposed-plan-action"
        prompt={resolvedCopy.prompt}
        title={resolvedCopy.title}
      />
    );
  }

  const submitting = submittingDecision !== null;

  return (
    <InlineActionFrame
      ariaLabel="proposed plan action"
      className="proposed-plan-action"
      prompt="Switch to Default and start coding, or continue planning with this plan in the transcript."
      title="Implement this plan?"
    >
      <div className="inline-action-card-actions">
        {onConfirmProposedPlanAction ? (
          <InlineActionButton
            disabled={submitting}
            onClick={() => void runAction('implement')}
            primary
            type="button"
          >
            {submittingDecision === 'implement' ? 'Submitting…' : 'Implement plan'}
          </InlineActionButton>
        ) : null}
        {onDismissProposedPlanAction ? (
          <InlineActionButton
            disabled={submitting}
            onClick={() => void runAction('stayInPlan')}
            type="button"
          >
            {submittingDecision === 'stayInPlan' ? 'Saving…' : 'Stay in Plan mode'}
          </InlineActionButton>
        ) : null}
      </div>
    </InlineActionFrame>
  );
}
