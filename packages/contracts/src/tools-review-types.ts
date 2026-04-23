export type ReviewStartTarget =
  | { type: 'uncommittedChanges' }
  | { type: 'baseBranch'; branch: string }
  | { type: 'commit'; sha: string; title?: string }
  | { type: 'custom'; instructions: string };

export type ReviewStartAcceptedPayload = {
  ok: boolean;
  reviewThreadId?: string;
};
