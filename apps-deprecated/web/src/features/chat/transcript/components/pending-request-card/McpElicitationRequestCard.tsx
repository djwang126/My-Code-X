import { useMemo, useState, type FormEvent } from 'react';

import type { PendingRequestCardProps } from '../../types';
import { LabeledLiteralField } from '../LabeledLiteralField';
import { PendingRequestActionButton, PendingRequestActionLink } from './PendingRequestActions';
import { PendingRequestFrame } from './PendingRequestFrame';

export function McpElicitationRequestCard({ request, onRequestResponse }: PendingRequestCardProps) {
  const [values, setValues] = useState<Record<string, string>>({});
  const submitting = request.submitState === 'submitting';
  const schemaProperties = useMemo(
    () => (request.mode === 'form' ? request.requestedSchema?.properties ?? {} : {}),
    [request.mode, request.requestedSchema],
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const content = Object.entries(schemaProperties).reduce<Record<string, unknown>>((nextContent, [key]) => {
      nextContent[key] = values[key] ?? '';
      return nextContent;
    }, {});

    await onRequestResponse?.(request.id, {
      action: 'accept',
      content,
    });
  }

  return (
    <PendingRequestFrame request={request}>
      <div className="timeline-card-fields pending-request-meta">
        <LabeledLiteralField
          className="timeline-card-field"
          label="Server"
          labelClassName="timeline-card-field-label"
          value={request.serverName}
          valueClassName="literal-content-compact timeline-card-field-value"
        />
      </div>
      {request.mode === 'url' && request.url ? (
        <div className="pending-request-actions">
          <PendingRequestActionLink href={request.url} rel="noreferrer" target="_blank">
            Open URL
          </PendingRequestActionLink>
          <PendingRequestActionButton
            disabled={submitting}
            onClick={() => void onRequestResponse?.(request.id, { action: 'accept', content: null })}
            primary
            type="button"
          >
            Accept
          </PendingRequestActionButton>
          <PendingRequestActionButton
            disabled={submitting}
            onClick={() => void onRequestResponse?.(request.id, { action: 'decline', content: null })}
            type="button"
          >
            Decline
          </PendingRequestActionButton>
          <PendingRequestActionButton
            disabled={submitting}
            onClick={() => void onRequestResponse?.(request.id, { action: 'cancel', content: null })}
            type="button"
          >
            Cancel
          </PendingRequestActionButton>
        </div>
      ) : null}
      {request.mode === 'form' ? (
        <form className="pending-request-form" onSubmit={handleSubmit}>
          {Object.entries(schemaProperties).map(([key, definition]) => (
            <label className="pending-request-input-group" key={key}>
              <span>{String((definition as { title?: unknown })?.title || key)}</span>
              <input
                aria-label={String((definition as { title?: unknown })?.title || key)}
                disabled={submitting}
                onChange={event => setValues(current => ({ ...current, [key]: event.target.value }))}
                value={values[key] ?? ''}
              />
            </label>
          ))}
          <div className="pending-request-actions">
            <PendingRequestActionButton disabled={submitting} primary type="submit">
              Submit form
            </PendingRequestActionButton>
          </div>
        </form>
      ) : null}
    </PendingRequestFrame>
  );
}
