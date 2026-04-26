// This module owns session lifetime state.
// Other features must not import or mutate this state.
// Cross-feature access must go through application use cases.
export type SessionState = unknown;

export function createInitialSessionState(): SessionState {
  return null;
}
