import { describe, expect, it } from 'vitest';

import {
  parseSessionStreamAssistantDelta,
  parseSessionStreamError,
  parseSessionStreamMessageCompleted,
  parseSessionStreamPendingRequestResolved,
  parseSessionStreamPendingRequestUpdated,
  parseSessionStreamSessionMetaUpdated,
  parseSessionStreamSnapshot,
  parseSessionStreamSystemNotice,
  parseSessionStreamTimelineItemDelta,
  parseSessionStreamTurnStarted,
  parseSessionStreamTurnCompleted,
} from './parse-session-stream';

describe('session stream payload parsing', () => {
  it('parses snapshots with canonical interrupting execution state', () => {
    const payload = parseSessionStreamSnapshot({
      threadId: 'thread-1',
      turnExecution: {
        activeTurnId: 'turn-1',
        turnLifecycle: 'interrupting',
      },
      messages: [],
    });

    expect(payload).toEqual({
      threadId: 'thread-1',
      turnExecution: {
        activeTurnId: 'turn-1',
        turnLifecycle: 'interrupting',
      },
      collaborationModeKind: undefined,
      promptOverride: undefined,
      messages: [],
      threadName: undefined,
      threadStatus: undefined,
      threadStatusText: undefined,
      tokenUsageText: undefined,
      notices: undefined,
      pendingRequests: undefined,
      lastError: undefined,
    });
  });

  it('parses assistant, timeline, and turn execution stream payloads through the canonical contract', () => {
    expect(
      parseSessionStreamAssistantDelta({
        threadId: 'thread-1',
        turnId: 'turn-1',
        messageId: 'assistant-1',
        delta: 'hello',
        text: 'hello',
      }),
    ).toEqual({
      threadId: 'thread-1',
      turnId: 'turn-1',
      messageId: 'assistant-1',
      delta: 'hello',
      text: 'hello',
    });

    expect(
      parseSessionStreamTimelineItemDelta({
        threadId: 'thread-1',
        turnId: 'turn-1',
        itemId: 'plan-1',
        itemType: 'plan',
        deltaField: 'summary',
        index: 0,
        delta: 'Inspect reducer state',
      }),
    ).toEqual({
      threadId: 'thread-1',
      turnId: 'turn-1',
      itemId: 'plan-1',
      itemType: 'plan',
      deltaField: 'summary',
      index: 0,
      delta: 'Inspect reducer state',
    });

    expect(
      parseSessionStreamMessageCompleted({
        threadId: 'thread-1',
        turnId: 'turn-1',
        message: {
          id: 'assistant-1',
          kind: 'message',
          itemType: 'agentMessage',
          role: 'assistant',
          text: 'done',
          state: 'complete',
          threadId: 'thread-1',
          turnId: 'turn-1',
        },
      }),
    ).toMatchObject({
      threadId: 'thread-1',
      turnId: 'turn-1',
      message: {
        id: 'assistant-1',
        text: 'done',
      },
    });

    expect(
      parseSessionStreamTurnStarted({
        threadId: 'thread-1',
        turnExecution: {
          activeTurnId: 'turn-1',
          turnLifecycle: 'running',
        },
      }),
    ).toEqual({
      threadId: 'thread-1',
      turnExecution: {
        activeTurnId: 'turn-1',
        turnLifecycle: 'running',
      },
    });

    expect(
      parseSessionStreamTurnCompleted({
        threadId: 'thread-1',
        turnExecution: {
          activeTurnId: 'turn-1',
          turnLifecycle: 'interrupted',
        },
        error: null,
      }),
    ).toEqual({
      threadId: 'thread-1',
      turnExecution: {
        activeTurnId: 'turn-1',
        turnLifecycle: 'interrupted',
      },
      error: null,
    });
  });

  it('parses meta, notice, pending request, and error stream payloads', () => {
    expect(
      parseSessionStreamSessionMetaUpdated({
        threadId: 'thread-1',
        threadName: 'Renamed thread',
        threadStatus: {
          type: 'running',
          activeFlags: ['busy'],
        },
      }),
    ).toEqual({
      threadId: 'thread-1',
      threadName: 'Renamed thread',
      threadStatus: {
        type: 'running',
        activeFlags: ['busy'],
      },
    });

    expect(
      parseSessionStreamSystemNotice({
        threadId: 'thread-1',
        notice: {
          id: 'notice-1',
          level: 'warning',
          title: 'Heads up',
          text: 'Be careful',
        },
      }),
    ).toEqual({
      threadId: 'thread-1',
      notice: {
        id: 'notice-1',
        level: 'warning',
        title: 'Heads up',
        text: 'Be careful',
      },
    });

    expect(
      parseSessionStreamPendingRequestUpdated({
        threadId: 'thread-1',
        request: {
          id: 'request-1',
          method: 'item/tool/requestUserInput',
          kind: 'user_input',
          threadId: 'thread-1',
          turnId: 'turn-1',
          title: 'Need input',
          prompt: 'choose one',
          submitState: 'idle',
        },
      }),
    ).toMatchObject({
      threadId: 'thread-1',
      request: {
        id: 'request-1',
        submitState: 'idle',
      },
    });

    expect(
      parseSessionStreamPendingRequestResolved({
        threadId: 'thread-1',
        requestId: 'request-1',
        notice: {
          id: 'notice-2',
          level: 'info',
          title: 'Resolved',
          text: 'Thanks',
        },
      }),
    ).toEqual({
      threadId: 'thread-1',
      requestId: 'request-1',
      notice: {
        id: 'notice-2',
        level: 'info',
        title: 'Resolved',
        text: 'Thanks',
      },
    });

    expect(
      parseSessionStreamError({
        threadId: 'thread-1',
        turnId: null,
        error: {
          message: 'stream broke',
          codexErrorInfo: null,
          additionalDetails: null,
          httpStatusCode: null,
          willRetry: null,
          threadId: 'thread-1',
          turnId: null,
          presentationScope: 'shared',
          source: 'error_notification',
          raw: null,
        },
      }),
    ).toEqual({
      threadId: 'thread-1',
      turnId: null,
      error: {
        message: 'stream broke',
        codexErrorInfo: null,
        additionalDetails: null,
        httpStatusCode: null,
        willRetry: null,
        threadId: 'thread-1',
        turnId: null,
        presentationScope: 'shared',
        source: 'error_notification',
        raw: null,
      },
    });
  });

  it('fails explicitly when a timeline delta uses an unsupported deltaField', () => {
    expect(() =>
      parseSessionStreamTimelineItemDelta({
        threadId: 'thread-1',
        turnId: 'turn-1',
        itemId: 'plan-1',
        itemType: 'plan',
        deltaField: 'unsupported',
      }),
    ).toThrowError(
      'session stream timeline item delta.deltaField must be one of summary, summary_boundary, content, aggregatedOutput, output, progress, terminalInteraction.',
    );
  });

  it('fails explicitly when snapshots only send legacy activeTurnId and turnLifecycle fields', () => {
    expect(() =>
      parseSessionStreamSnapshot({
        threadId: 'thread-1',
        activeTurnId: 'turn-1',
        turnLifecycle: 'running',
        messages: [],
      }),
    ).toThrowError('session stream snapshot.turnExecution must be an object.');
  });
});
