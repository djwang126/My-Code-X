import type { ReactNode } from 'react';

import { MarkdownMessage } from '../../lib/message-markdown';

interface InlineActionFrameProps {
  ariaLabel: string;
  title: string;
  prompt?: string;
  badge?: string;
  className?: string;
  children?: ReactNode;
}

function joinClassNames(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

export function InlineActionFrame({
  ariaLabel,
  title,
  prompt = '',
  badge,
  className,
  children,
}: InlineActionFrameProps) {
  return (
    <article aria-label={ariaLabel} className={joinClassNames('timeline-card-panel inline-action-card', className)}>
      <div className="timeline-card-header inline-action-card-header">
        <div className="inline-action-card-title-row">
          <div className="inline-action-card-title" role="heading" aria-level={3}>
            <MarkdownMessage className="markdown-content-compact inline-action-card-title-copy" text={title} />
          </div>
          {badge ? <span className="inline-action-card-badge">{badge}</span> : null}
        </div>
      </div>
      <div className="timeline-card-content inline-action-card-content">
        {prompt ? <MarkdownMessage className="markdown-content-compact inline-action-card-copy" text={prompt} /> : null}
        {children}
      </div>
    </article>
  );
}
