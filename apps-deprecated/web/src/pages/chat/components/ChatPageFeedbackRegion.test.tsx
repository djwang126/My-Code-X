import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ChatPageFeedbackRegion } from './ChatPageFeedbackRegion';

describe('ChatPageFeedbackRegion', () => {
  it('renders nothing when no page feedback is present', () => {
    const { container } = render(<ChatPageFeedbackRegion feedback={null} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('renders the page feedback as an alert', () => {
    render(
      <ChatPageFeedbackRegion
        feedback={{
          scope: 'page',
          error: {
            kind: 'send',
            message: 'Send failed',
          },
        }}
      />,
    );

    expect(screen.getByRole('alert', { name: 'Chat page feedback' })).toHaveTextContent('Send failed');
  });
});
