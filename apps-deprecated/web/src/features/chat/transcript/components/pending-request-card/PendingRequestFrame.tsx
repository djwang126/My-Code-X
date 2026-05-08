import type { ReactNode } from 'react';

import type { SessionPendingRequest } from '../../../runtime/public-types';
import { MarkdownMessage } from '../../lib/message-markdown';

interface PendingRequestFrameProps {
  request: SessionPendingRequest;
  stale?: boolean;
  children: ReactNode;
}

export function PendingRequestFrame({ request, stale = false, children }: PendingRequestFrameProps) {
  return (
    <article
      aria-label={`${request.kind} request`}
      className={`timeline-card-panel pending-request pending-request--${request.kind} ${stale ? 'is-stale' : ''}`}
    >
      <div className="timeline-card-header pending-request-header">
        <div className="pending-request-title-row">
          <div className="pending-request-title" role="heading" aria-level={3}>
            <MarkdownMessage className="markdown-content-compact" text={request.title} />
          </div>
          {stale ? <span className="pending-request-state-badge">Expired</span> : null}
        </div>
      </div>
      <div className="timeline-card-content pending-request-content">
        {request.prompt ? <MarkdownMessage className="markdown-content-compact pending-request-copy" text={request.prompt} /> : null}
        {children}
      </div>
    </article>
  );
}
