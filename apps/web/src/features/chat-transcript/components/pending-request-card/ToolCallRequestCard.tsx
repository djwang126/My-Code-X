import { useState, type FormEvent } from 'react';

import type { PendingRequestCardProps } from '../../types';
import { LabeledLiteralField } from '../LabeledLiteralField';
import { PendingRequestActionButton } from './PendingRequestActions';
import { PendingRequestFrame } from './PendingRequestFrame';

export function ToolCallRequestCard({ request, onRequestResponse }: PendingRequestCardProps) {
  const [text, setText] = useState('');
  const submitting = request.submitState === 'submitting';

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    await onRequestResponse?.(request.id, {
      success: true,
      contentItems: [
        {
          type: 'inputText',
          text,
        },
      ],
    });
  }

  return (
    <PendingRequestFrame request={request}>
      <div className="timeline-card-fields pending-request-meta">
        <LabeledLiteralField
          className="timeline-card-field"
          label="Arguments"
          labelClassName="timeline-card-field-label"
          value={request.arguments}
          valueClassName="literal-content-compact timeline-card-field-value"
        />
      </div>
      <form className="pending-request-form" onSubmit={handleSubmit}>
        <label className="pending-request-input-group">
          <span>Tool response</span>
          <textarea aria-label="Tool response" disabled={submitting} onChange={event => setText(event.target.value)} value={text} />
        </label>
        <div className="pending-request-actions">
          <PendingRequestActionButton disabled={submitting} primary type="submit">
            Send tool response
          </PendingRequestActionButton>
        </div>
      </form>
    </PendingRequestFrame>
  );
}
