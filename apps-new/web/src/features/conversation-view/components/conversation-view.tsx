import type { ClientConversationView } from '@my-code-x/contracts-new';
import {
  createConversationViewModelFromSnapshot,
  type ConversationViewModel,
} from '../model/index.js';

export interface ConversationViewProps {
  readonly conversation: ClientConversationView;
}

export function ConversationView(input: ConversationViewProps) {
  const model = createConversationViewModelFromSnapshot({ conversation: input.conversation });

  return (
    <section className="conversation-view" aria-labelledby="conversation-view-title">
      <h2 className="conversation-view__title" id="conversation-view-title">
        Conversation View
      </h2>
      <ConversationViewBody model={model} />
    </section>
  );
}

interface ConversationViewBodyProps {
  readonly model: ConversationViewModel;
}

function ConversationViewBody(input: ConversationViewBodyProps) {
  switch (input.model.status) {
    case 'loading':
      return (
        <div className="conversation-view__placeholder" role="status">
          <p className="conversation-view__body">Loading conversation…</p>
        </div>
      );

    case 'empty':
      return (
        <div className="conversation-view__placeholder">
          <p className="conversation-view__body">No conversation yet.</p>
        </div>
      );

    case 'failed':
      return (
        <div className="conversation-view__placeholder" role="alert">
          <p className="conversation-view__body conversation-view__body--error">
            {input.model.error.message}
          </p>
        </div>
      );

    case 'timeline':
      return (
        <ol className="conversation-view__timeline" aria-label="Conversation timeline">
          {input.model.items.map(item => (
            <li className="conversation-view__timeline-item" key={item.id}>
              {item.text}
            </li>
          ))}
        </ol>
      );
  }
}
