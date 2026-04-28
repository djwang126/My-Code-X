import type { EventBusPort } from '../../ports/index.js';

export interface ConversationDependencies {
  readonly events: EventBusPort;
}
