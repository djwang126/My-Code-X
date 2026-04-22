import { FeedbackMessage } from '../../../shared/components/feedback';
import type { SessionToastItem } from '../types';

type SessionToastRegionProps = {
  toasts: SessionToastItem[];
};

export function SessionToastRegion({ toasts }: SessionToastRegionProps) {
  if (!toasts.length) {
    return null;
  }

  return (
    <section aria-label="Session toasts">
      {toasts.map(notice => (
        <FeedbackMessage key={notice.key} layout="toast" title={notice.title} tone={notice.tone}>
          {notice.text}
        </FeedbackMessage>
      ))}
    </section>
  );
}
