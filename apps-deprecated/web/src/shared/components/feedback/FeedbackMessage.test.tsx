import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { FeedbackBlockingState, FeedbackEmptyState, FeedbackMessage } from './FeedbackMessage';

describe('FeedbackMessage', () => {
  it('renders a warning toast with title and content', () => {
    render(
      <FeedbackMessage ariaLabel="warning toast" layout="toast" title="Heads up" tone="warning">
        Changes were saved locally.
      </FeedbackMessage>,
    );

    const message = screen.getByRole('status', { name: 'warning toast' });
    expect(message).toHaveClass('feedback', 'feedback-toast', 'feedback-warning');
    expect(screen.getByText('Heads up')).toBeInTheDocument();
    expect(screen.getByText('Changes were saved locally.')).toBeInTheDocument();
  });

  it('renders a blocking error with actions', () => {
    render(
      <FeedbackBlockingState
        actions={<button type="button">Retry</button>}
        ariaLabel="fatal error"
        title="Cannot connect"
        tone="error"
      >
        The local gateway did not respond.
      </FeedbackBlockingState>,
    );

    const blocking = screen.getByRole('alert', { name: 'fatal error' });
    expect(blocking).toHaveClass('feedback', 'feedback-blocking', 'feedback-error');
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('renders a compact empty state without description', () => {
    render(<FeedbackEmptyState compact title="No saved threads yet." />);

    expect(screen.getByText('No saved threads yet.')).toHaveClass('feedback-empty-title');
  });
});
