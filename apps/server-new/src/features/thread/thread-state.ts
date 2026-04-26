// This module owns thread lifetime state.
// Other features must not import or mutate this state.
// Cross-feature access must go through application use cases.
export type ThreadState = unknown;

export function createInitialThreadState(): ThreadState {
  return null;
}
