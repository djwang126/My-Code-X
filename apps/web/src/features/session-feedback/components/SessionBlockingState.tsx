import type { ReactNode } from 'react';

import { FeedbackBlockingState } from '../../../shared/components/feedback';

type SessionBlockingStateProps = {
  title?: string;
  tone?: 'neutral' | 'info' | 'warning' | 'error';
  message?: ReactNode;
  actions?: ReactNode;
  ariaLabel?: string;
  children?: ReactNode;
};

export function SessionBlockingState(props: SessionBlockingStateProps) {
  return <FeedbackBlockingState {...props} />;
}
