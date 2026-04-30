import { createConversationViewApiBoundary } from '../api/index.js';
import { createInitialConversationViewModel } from '../model/index.js';

export function ConversationView() {
  const api = createConversationViewApiBoundary();
  const model = createInitialConversationViewModel();

  return (
    <section className="conversation-view" aria-labelledby="conversation-view-title">
      <div className="conversation-view__placeholder">
        <h2 className="conversation-view__title" id="conversation-view-title">
          Conversation View
        </h2>
        <p className="conversation-view__body">
          App shell is ready. Contract v{api.contractVersion} is available, and the read-only
          conversation region is mounted in {model.regionName} mode.
        </p>
      </div>
    </section>
  );
}
