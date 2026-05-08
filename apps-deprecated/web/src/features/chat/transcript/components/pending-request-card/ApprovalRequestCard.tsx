import type { PendingRequestCardProps } from '../../types';
import { LabeledLiteralField } from '../LabeledLiteralField';
import { PendingRequestActionButton } from './PendingRequestActions';
import { PendingRequestFrame } from './PendingRequestFrame';
import {
  getApprovalDecisionOptions,
  getApprovalResponsePayload,
  isPrimaryApprovalDecision,
} from './approval-request-model';

export function ApprovalRequestCard({ request, onRequestResponse }: PendingRequestCardProps) {
  const submitting = request.submitState === 'submitting';
  const decisions = getApprovalDecisionOptions(request);

  return (
    <PendingRequestFrame request={request}>
      <div className="timeline-card-fields pending-request-meta">
        <LabeledLiteralField
          className="timeline-card-field"
          label="Command"
          labelClassName="timeline-card-field-label"
          value={request.command}
          valueClassName="literal-content-compact timeline-card-field-value"
        />
        <LabeledLiteralField
          className="timeline-card-field"
          label="Cwd"
          labelClassName="timeline-card-field-label"
          value={request.cwd}
          valueClassName="literal-content-compact timeline-card-field-value"
        />
        <LabeledLiteralField
          className="timeline-card-field"
          label="Reason"
          labelClassName="timeline-card-field-label"
          value={request.reason}
          valueClassName="literal-content-compact timeline-card-field-value"
        />
        <LabeledLiteralField
          className="timeline-card-field"
          label="Grant root"
          labelClassName="timeline-card-field-label"
          value={request.grantRoot}
          valueClassName="literal-content-compact timeline-card-field-value"
        />
        <LabeledLiteralField
          className="timeline-card-field"
          label="Permissions"
          labelClassName="timeline-card-field-label"
          value={request.permissions}
          valueClassName="literal-content-compact timeline-card-field-value"
        />
      </div>
      <div className="pending-request-actions">
        {decisions.map(decision => (
          <PendingRequestActionButton
            disabled={submitting}
            key={`${request.id}-${typeof decision.value === 'string' ? decision.value : JSON.stringify(decision.value)}`}
            onClick={() =>
              void onRequestResponse?.(
                request.id,
                getApprovalResponsePayload({
                  request,
                  decision: decision.value,
                }),
              )
            }
            primary={isPrimaryApprovalDecision(decision.value)}
            type="button"
          >
            {decision.label}
          </PendingRequestActionButton>
        ))}
      </div>
    </PendingRequestFrame>
  );
}
