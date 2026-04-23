import type { SessionTimelineItem, SessionTimelineSpecialItem } from '../session-types';
import type { SessionStreamTimelineItemDelta } from '../types/session-stream-types';
import { upsertMessage } from './session-collections';

type TimelineItemRawState = Record<string, unknown> & {
  type: string;
  id: string;
  text?: string;
  summary?: unknown;
  content?: unknown;
  aggregatedOutput?: string;
  command?: string;
  output?: string;
  progress?: unknown;
  server?: string;
  tool?: string;
  terminalInteraction?: unknown;
};

function createStreamingSpecialItem(payload: SessionStreamTimelineItemDelta): SessionTimelineSpecialItem {
  return {
    id: payload.itemId,
    kind: 'special',
    itemType: payload.itemType,
    text: '',
    state: 'streaming',
    threadId: payload.threadId,
    turnId: payload.turnId,
    raw: {
      type: payload.itemType,
      id: payload.itemId,
    },
  };
}

function isHiddenLargeTimelineDelta(payload: SessionStreamTimelineItemDelta) {
  return payload.deltaField === 'aggregatedOutput' || payload.deltaField === 'output';
}

function findOrCreateTimelineItem(
  messages: SessionTimelineItem[],
  payload: SessionStreamTimelineItemDelta,
) {
  const existing = messages.find(message => message.id === payload.itemId);

  if (existing && existing.kind === 'special') {
    return existing;
  }

  return createStreamingSpecialItem(payload);
}

function appendIndexedText(value: unknown, index: number | undefined, delta: string) {
  if (typeof index !== 'number') {
    return `${typeof value === 'string' ? value : ''}${delta}`;
  }

  const nextEntries = Array.isArray(value) ? [...value] : [];
  const currentEntry = nextEntries[index];
  const currentText =
    typeof currentEntry === 'string'
      ? currentEntry
      : typeof currentEntry?.text === 'string'
        ? currentEntry.text
        : '';

  nextEntries[index] =
    typeof currentEntry === 'object' && currentEntry !== null
      ? { ...currentEntry, text: `${currentText}${delta}` }
      : { text: `${currentText}${delta}` };

  return nextEntries;
}

function extractReasoningText(raw: Record<string, unknown>) {
  if (typeof raw.summary === 'string' && raw.summary) {
    return raw.summary;
  }

  if (Array.isArray(raw.summary)) {
    return raw.summary
      .map(entry => (typeof entry === 'string' ? entry : typeof entry?.text === 'string' ? entry.text : ''))
      .join('');
  }

  if (typeof raw.content === 'string' && raw.content) {
    return raw.content;
  }

  if (Array.isArray(raw.content)) {
    return raw.content
      .map(entry => (typeof entry === 'string' ? entry : typeof entry?.text === 'string' ? entry.text : ''))
      .join('');
  }

  return '';
}

function applyDeltaToItem(
  item: SessionTimelineSpecialItem,
  payload: SessionStreamTimelineItemDelta,
): SessionTimelineSpecialItem {
  const nextRaw: TimelineItemRawState = {
    type: payload.itemType,
    id: payload.itemId,
    ...(item.raw || {}),
  };
  const nextItem: SessionTimelineSpecialItem = {
    ...item,
    state: 'streaming',
    threadId: payload.threadId,
    turnId: payload.turnId ?? item.turnId,
    raw: nextRaw,
  };

  if (payload.itemType === 'plan') {
    const nextText = `${typeof nextRaw.text === 'string' ? nextRaw.text : ''}${payload.delta || ''}`;
    nextRaw.text = nextText;
    nextItem.text = nextText;
    return nextItem;
  }

  if (payload.itemType === 'reasoning') {
    if (payload.deltaField === 'summary') {
      nextRaw.summary = appendIndexedText(nextRaw.summary, payload.index, payload.delta || '');
    } else if (payload.deltaField === 'summary_boundary') {
      nextRaw.summary = appendIndexedText(nextRaw.summary, payload.index, '');
    } else if (payload.deltaField === 'content') {
      nextRaw.content = appendIndexedText(nextRaw.content, payload.index, payload.delta || '');
    }

    nextItem.text = extractReasoningText(nextRaw);
    return nextItem;
  }

  if (payload.deltaField === 'aggregatedOutput') {
    const nextOutput = `${typeof nextRaw.aggregatedOutput === 'string' ? nextRaw.aggregatedOutput : ''}${payload.delta || ''}`;
    nextRaw.aggregatedOutput = nextOutput;
    nextItem.text = typeof nextRaw.command === 'string' ? nextRaw.command : nextItem.text || nextOutput;
    return nextItem;
  }

  if (payload.deltaField === 'output') {
    const nextOutput = `${typeof nextRaw.output === 'string' ? nextRaw.output : ''}${payload.delta || ''}`;
    nextRaw.output = nextOutput;
    nextItem.text = nextItem.text || nextOutput;
    return nextItem;
  }

  if (payload.deltaField === 'progress') {
    nextRaw.progress = payload.value;
    if (!nextItem.text && typeof nextRaw.server === 'string' && typeof nextRaw.tool === 'string') {
      nextItem.text = `${nextRaw.server}.${nextRaw.tool}`;
    }
    return nextItem;
  }

  if (payload.deltaField === 'terminalInteraction') {
    nextRaw.terminalInteraction = payload.value;
    nextItem.text = nextItem.text || '[terminal interaction]';
    return nextItem;
  }

  if (typeof payload.delta === 'string') {
    nextItem.text = `${nextItem.text}${payload.delta}`;
  }

  return nextItem;
}

export function applyTimelineItemDelta(
  messages: SessionTimelineItem[],
  payload: SessionStreamTimelineItemDelta,
) {
  if (isHiddenLargeTimelineDelta(payload)) {
    return messages;
  }

  const targetItem = findOrCreateTimelineItem(messages, payload);
  return upsertMessage(messages, applyDeltaToItem(targetItem, payload));
}
