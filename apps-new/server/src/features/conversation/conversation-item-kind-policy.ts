import type { RuntimeItemDeltaKind, RuntimeThreadItem } from '../../ports/index.js';
import type { ConversationItem, ConversationMessageRole } from './conversation-events.js';

export type ConversationDeltaCodexType =
  | 'agentMessage'
  | 'plan'
  | 'reasoning'
  | 'commandExecution'
  | 'fileChange'
  | 'mcpToolCall';

export function readRuntimeMessageRole(item: RuntimeThreadItem): ConversationMessageRole | null {
  switch (item.itemKind) {
    case 'userMessage':
      return 'user';

    case 'agentMessage':
      return 'assistant';

    default:
      return null;
  }
}

const workTraceItemKinds = new Set<string>([
  'hookPrompt',
  'plan',
  'reasoning',
  'commandExecution',
  'fileChange',
  'mcpToolCall',
  'dynamicToolCall',
  'collabAgentToolCall',
  'webSearch',
  'imageView',
  'imageGeneration',
  'enteredReviewMode',
  'exitedReviewMode',
  'contextCompaction',
]);

export function isRuntimeWorkTraceItemKind(itemKind: string): boolean {
  return workTraceItemKinds.has(itemKind);
}

export function mapRuntimeDeltaKindToConversationCodexType(
  deltaKind: RuntimeItemDeltaKind,
): ConversationDeltaCodexType {
  switch (deltaKind) {
    case 'agent-message':
      return 'agentMessage';

    case 'plan':
      return 'plan';

    case 'reasoning-summary-text':
    case 'reasoning-summary-part':
    case 'reasoning-text':
      return 'reasoning';

    case 'command-output':
    case 'terminal-interaction':
      return 'commandExecution';

    case 'file-change-output':
    case 'file-change-patch':
      return 'fileChange';

    case 'mcp-tool-progress':
      return 'mcpToolCall';
  }
}

export function readConversationItemCodexType(item: ConversationItem): string {
  switch (item.kind) {
    case 'message':
      return item.role === 'assistant' ? 'agentMessage' : 'userMessage';

    case 'work-trace':
    case 'unknown':
      return item.codexType;

    case 'error':
      return 'error';
  }
}
