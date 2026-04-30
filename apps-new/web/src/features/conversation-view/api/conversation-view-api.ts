import { contractVersion, contractVersionSchema, type ContractVersion } from '@my-code-x/contracts-new';

export interface ConversationViewApiBoundary {
  readonly contractVersion: ContractVersion;
}

export function createConversationViewApiBoundary(): ConversationViewApiBoundary {
  return {
    contractVersion: contractVersionSchema.parse(contractVersion),
  };
}
