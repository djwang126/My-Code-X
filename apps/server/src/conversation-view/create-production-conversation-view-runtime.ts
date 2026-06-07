import type { ConversationViewRuntime } from "./conversation-view-runtime";

export class ConversationRuntimeConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConversationRuntimeConfigurationError";
  }
}

export function createProductionConversationViewRuntime(): ConversationViewRuntime {
  throw new ConversationRuntimeConfigurationError(
    "Production conversation runtime is not configured"
  );
}
