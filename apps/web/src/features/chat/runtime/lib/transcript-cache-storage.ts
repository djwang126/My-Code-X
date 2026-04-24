import { isChatTurnTerminal, parseNullableChatTurn, serializeChatTurn } from '@my-code-x/contracts';

import { clearSessionStorageValue, persistSessionStorageValue, readSessionStorageValue } from '../../../../shared/lib/browser-storage';
import { normalizeWorkspacePath } from '../../../../shared/lib/workspace-path';
import { readBootstrapScope } from '../../../session/scope';
import type { ChatTurn, SessionTimelineItem } from '../session-types';

const transcriptCacheStoragePrefix = 'my-code-x-transcript-cache:';

export type TranscriptCache = {
  workspace: string;
  threadId: string;
  threadName: string;
  latestTurn: ChatTurn | null;
  messages: SessionTimelineItem[];
};

function createTranscriptCacheStorageKey(threadId: string) {
  return `${transcriptCacheStoragePrefix}${threadId}`;
}

function parseTranscriptCache(raw: string | null): TranscriptCache | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw);
    const threadId = String(parsed?.threadId || '').trim();
    const workspace = normalizeWorkspacePath(parsed?.workspace || '');
    const threadName = String(parsed?.threadName || '');
    const latestTurn = parseNullableChatTurn(parsed?.latestTurn, { fieldName: 'transcript cache.latestTurn' });
    const messages = Array.isArray(parsed?.messages) ? (parsed.messages as SessionTimelineItem[]) : null;

    if (!threadId || !messages || !latestTurn) {
      return null;
    }

    return {
      workspace,
      threadId,
      threadName,
      latestTurn,
      messages,
    };
  } catch {
    return null;
  }
}

export function loadTranscriptCache(threadId: string): TranscriptCache | null {
  if (!threadId) {
    return null;
  }

  return parseTranscriptCache(readSessionStorageValue(createTranscriptCacheStorageKey(threadId)));
}

export function loadBootstrapTranscriptCache(): TranscriptCache | null {
  const scope = readBootstrapScope();
  const cache = loadTranscriptCache(scope.threadId);

  if (!cache || !isChatTurnTerminal(cache.latestTurn)) {
    return null;
  }

  if (cache.workspace !== normalizeWorkspacePath(scope.workspace)) {
    return null;
  }

  return cache;
}

export function persistTranscriptCache(cache: TranscriptCache) {
  const threadId = String(cache.threadId || '').trim();
  if (!threadId) {
    return;
  }

  const latestTurn = serializeChatTurn(cache.latestTurn, {
    fieldName: 'transcript cache.latestTurn',
  });

  persistSessionStorageValue(
    createTranscriptCacheStorageKey(threadId),
    JSON.stringify({
      workspace: normalizeWorkspacePath(cache.workspace),
      threadId,
      threadName: String(cache.threadName || ''),
      latestTurn,
      messages: cache.messages,
    }),
  );
}

export function clearTranscriptCache(threadId: string) {
  const resolvedThreadId = String(threadId || '').trim();
  if (!resolvedThreadId) {
    return;
  }

  clearSessionStorageValue(createTranscriptCacheStorageKey(resolvedThreadId));
}
