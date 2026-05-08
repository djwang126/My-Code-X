import { FeedbackMessage } from '../../../shared/components/feedback';
import type { ChatPageFeedback } from '../state/page-state-types';

type ChatPageFeedbackRegionProps = {
  feedback: ChatPageFeedback | null;
};

export function ChatPageFeedbackRegion({ feedback }: ChatPageFeedbackRegionProps) {
  if (!feedback) {
    return null;
  }

  return (
    <FeedbackMessage ariaLabel="Chat page feedback" tone="error">
      {feedback.error.message}
    </FeedbackMessage>
  );
}
