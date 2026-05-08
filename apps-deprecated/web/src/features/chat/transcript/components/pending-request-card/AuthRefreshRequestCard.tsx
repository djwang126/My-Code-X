import { useState, type FormEvent } from 'react';

import type { PendingRequestCardProps } from '../../types';
import { PendingRequestActionButton } from './PendingRequestActions';
import { PendingRequestFrame } from './PendingRequestFrame';

export function AuthRefreshRequestCard({ request, onRequestResponse }: PendingRequestCardProps) {
  const [accessToken, setAccessToken] = useState('');
  const [accountId, setAccountId] = useState(request.previousAccountId ?? '');
  const [planType, setPlanType] = useState('');
  const submitting = request.submitState === 'submitting';

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    await onRequestResponse?.(request.id, {
      accessToken,
      chatgptAccountId: accountId,
      ...(planType ? { chatgptPlanType: planType } : {}),
    });
  }

  return (
    <PendingRequestFrame request={request}>
      <form className="pending-request-form" onSubmit={handleSubmit}>
        <label className="pending-request-input-group">
          <span>Access token</span>
          <input aria-label="Access token" disabled={submitting} onChange={event => setAccessToken(event.target.value)} value={accessToken} />
        </label>
        <label className="pending-request-input-group">
          <span>Account id</span>
          <input aria-label="Account id" disabled={submitting} onChange={event => setAccountId(event.target.value)} value={accountId} />
        </label>
        <label className="pending-request-input-group">
          <span>Plan type</span>
          <input aria-label="Plan type" disabled={submitting} onChange={event => setPlanType(event.target.value)} value={planType} />
        </label>
        <div className="pending-request-actions">
          <PendingRequestActionButton disabled={submitting} primary type="submit">
            Submit tokens
          </PendingRequestActionButton>
        </div>
      </form>
    </PendingRequestFrame>
  );
}
