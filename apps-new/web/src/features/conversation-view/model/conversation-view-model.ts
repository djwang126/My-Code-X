export interface ConversationViewModel {
  readonly regionName: 'read-only';
}

export function createInitialConversationViewModel(): ConversationViewModel {
  return {
    regionName: 'read-only',
  };
}
