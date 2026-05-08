import { FeedbackMessage } from '../../../../shared/components/feedback';
import type { ChatToastItem } from '../types/chat-toast-types';

type ChatToastRegionProps = {
  toasts: ChatToastItem[];
};

export function ChatToastRegion({ toasts }: ChatToastRegionProps) {
  if (!toasts.length) {
    return null;
  }

  return (
    <section aria-label="Chat toasts">
      {toasts.map(notice => (
        <FeedbackMessage key={notice.key} layout="toast" title={notice.title} tone={notice.tone}>
          {notice.text}
        </FeedbackMessage>
      ))}
    </section>
  );
}
