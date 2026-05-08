import type { ReactNode } from 'react';

import './feedback.css';

type FeedbackTone = 'neutral' | 'info' | 'warning' | 'error';
type FeedbackLayout = 'inline' | 'toast' | 'blocking' | 'subtle';

type FeedbackMessageProps = {
  tone?: FeedbackTone;
  layout?: FeedbackLayout;
  title?: string;
  message?: ReactNode;
  actions?: ReactNode;
  className?: string;
  compact?: boolean;
  ariaLabel?: string;
  children?: ReactNode;
};

type FeedbackEmptyStateProps = {
  title: string;
  description?: string;
  icon?: ReactNode;
  compact?: boolean;
  className?: string;
  ariaLabel?: string;
};

type FeedbackBlockingStateProps = Omit<FeedbackMessageProps, 'layout' | 'compact'>;

function joinClassNames(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

function getFeedbackRole(tone: FeedbackTone) {
  return tone === 'error' ? 'alert' : 'status';
}

export function FeedbackMessage({
  tone = 'neutral',
  layout = 'inline',
  title,
  message,
  actions,
  className,
  compact = false,
  ariaLabel,
  children,
}: FeedbackMessageProps) {
  const content = children ?? message;

  return (
    <section
      aria-label={ariaLabel}
      aria-live={tone === 'error' ? 'assertive' : 'polite'}
      className={joinClassNames('feedback', `feedback-${layout}`, `feedback-${tone}`, compact && 'feedback-compact', className)}
      role={getFeedbackRole(tone)}
    >
      {title ? <div className="feedback-title">{title}</div> : null}
      {content ? <div className="feedback-message">{content}</div> : null}
      {actions ? <div className="feedback-actions">{actions}</div> : null}
    </section>
  );
}

export function FeedbackEmptyState({ title, description, icon, compact = false, className, ariaLabel }: FeedbackEmptyStateProps) {
  return (
    <section aria-label={ariaLabel} className={joinClassNames('feedback-empty', compact && 'feedback-empty-compact', className)}>
      {icon ? <div className="feedback-empty-icon">{icon}</div> : null}
      <div className="feedback-empty-copy">
        <p className="feedback-empty-title">{title}</p>
        {description ? <p className="feedback-empty-description">{description}</p> : null}
      </div>
    </section>
  );
}

export function FeedbackBlockingState(props: FeedbackBlockingStateProps) {
  return (
    <div className="feedback-blocking-shell">
      <FeedbackMessage {...props} layout="blocking" />
    </div>
  );
}
