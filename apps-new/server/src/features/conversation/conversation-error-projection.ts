import type { RuntimeErrorInfo } from '../../ports/index.js';
import type { ConversationErrorItem } from './conversation-events.js';

export interface CreateConversationErrorItemIdInput {
  readonly turnId: string;
}

export function createConversationErrorItemId(input: CreateConversationErrorItemIdInput): string {
  return `error:${input.turnId}`;
}

export interface ProjectRuntimeErrorInput {
  readonly turnId: string;
  readonly error: RuntimeErrorInfo;
}

export function projectRuntimeError(input: ProjectRuntimeErrorInput): ConversationErrorItem {
  return {
    id: createConversationErrorItemId({ turnId: input.turnId }),
    kind: 'error',
    message: input.error.message,
  };
}
