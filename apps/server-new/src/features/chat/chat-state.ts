// This module owns chat execution state.
// Other features must not import or mutate this state.
// Cross-feature access must go through application use cases.
export type ChatState = unknown;

export function createInitialChatState(): ChatState {
  return null;
}
