import type { ReactNode } from 'react';

import type { SessionPendingRequest } from '../../../runtime/public-types';
import { InlineActionFrame } from '../inline-action-card/InlineActionFrame';

interface PendingRequestFrameProps {
  request: SessionPendingRequest;
  stale?: boolean;
  children: ReactNode;
}

export function PendingRequestFrame({ request, stale = false, children }: PendingRequestFrameProps) {
  return (
    <InlineActionFrame
      ariaLabel={`${request.kind} request`}
      badge={stale ? 'Expired' : undefined}
      className={`pending-request pending-request--${request.kind} ${stale ? 'is-stale' : ''}`}
      prompt={request.prompt}
      title={request.title}
    >
      {children}
    </InlineActionFrame>
  );
}
