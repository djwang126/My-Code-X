import type { ChatPageErrorKind } from './chat-page-state-types';

export type ChatPageErrorScope = 'blocking' | 'page' | 'module';

const chatPageErrorScopeByKind: Record<ChatPageErrorKind, ChatPageErrorScope> = {
  bootstrap: 'blocking',
  send: 'page',
  interrupt: 'page',
  restart: 'page',
  rollback: 'page',
  compact: 'page',
  'review-start': 'page',
  'message-fork': 'page',
  'workspace-switch': 'page',
  'workspace-save': 'module',
  'thread-history': 'module',
  'pending-request': 'page',
  'workspace-file-open': 'module',
  'workspace-file-save': 'module',
  unknown: 'page',
};

export function getChatPageErrorScope(kind: ChatPageErrorKind): ChatPageErrorScope {
  return chatPageErrorScopeByKind[kind];
}

export function isPageScopedChatPageError(kind: ChatPageErrorKind) {
  return getChatPageErrorScope(kind) === 'page';
}
