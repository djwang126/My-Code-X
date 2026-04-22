import type { SessionTimelineItem, SessionTimelineSpecialItem } from '../../../chat-runtime/public-types';

const specialItemLabels: Record<string, string> = {
  hookPrompt: 'Hook prompt',
  plan: 'Plan',
  reasoning: 'Reasoning',
  commandExecution: 'Command execution',
  fileChange: 'File change',
  mcpToolCall: 'MCP tool call',
  dynamicToolCall: 'Dynamic tool call',
  collabAgentToolCall: 'Collab agent',
  collabToolCall: 'Collab agent',
  webSearch: 'Web search',
  enteredReviewMode: 'Entered review mode',
  exitedReviewMode: 'Exited review mode',
  contextCompaction: 'Context compacted',
};

export function getSpecialItemLabel(itemType: string) {
  return specialItemLabels[itemType] ?? itemType;
}

export function getOptionalString(value: unknown) {
  return typeof value === 'string' ? value : undefined;
}

export function isLargeTranscriptItem(
  message: Exclude<SessionTimelineItem, { kind: 'message' }>,
): message is SessionTimelineSpecialItem & { itemType: 'commandExecution' | 'fileChange' } {
  return message.kind !== 'fallback' && (message.itemType === 'commandExecution' || message.itemType === 'fileChange');
}

export function hasReasoningContent(value: unknown) {
  if (typeof value === 'string') {
    return Boolean(value);
  }

  if (!Array.isArray(value)) {
    return false;
  }

  return value.some(entry => {
    if (typeof entry === 'string') {
      return Boolean(entry);
    }

    return typeof entry?.text === 'string' && Boolean(entry.text);
  });
}

export function shouldShowReasoningPlaceholder(message: Exclude<SessionTimelineItem, { kind: 'message' }>) {
  if (message.kind === 'fallback' || message.itemType !== 'reasoning') {
    return false;
  }

  if (message.text) {
    return false;
  }

  return !hasReasoningContent(message.raw?.summary) && !hasReasoningContent(message.raw?.content);
}

export function shouldRenderSpecialTextAsMarkdown(message: Exclude<SessionTimelineItem, { kind: 'message' }>) {
  if (message.kind === 'fallback') {
    return false;
  }

  return message.itemType === 'reasoning' || message.itemType === 'plan';
}

export function shouldHideSpecialText(message: Exclude<SessionTimelineItem, { kind: 'message' }>) {
  return (
    message.kind !== 'fallback' &&
    message.itemType === 'commandExecution' &&
    typeof message.raw?.command === 'string' &&
    message.raw.command === message.text
  );
}
