import type { ChatPageError } from './chat-page-state-types';

export type ChatPageErrorAction =
  | { type: 'error/recorded'; error: ChatPageError }
  | { type: 'error/cleared' };

export function chatPageErrorReducer(
  state: ChatPageError | null,
  action: ChatPageErrorAction,
): ChatPageError | null {
  if (action.type === 'error/recorded') {
    return action.error;
  }

  return null;
}
