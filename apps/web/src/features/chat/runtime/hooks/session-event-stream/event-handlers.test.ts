import { describe, expect, it, vi } from 'vitest';

import { createSessionEventHandlers } from './event-handlers';

function createHandlers() {
  const dispatch = vi.fn();
  const handlers = createSessionEventHandlers({
    dispatch,
    flushAssistantDeltas: vi.fn(),
    onAssistantDelta: vi.fn(),
    threadId: 'thread-live',
  });

  return { dispatch, handlers };
}

function expectInvalidStreamPayloadDispatch(dispatch: ReturnType<typeof vi.fn>) {
  expect(dispatch).toHaveBeenCalledWith({
    type: 'stream/error',
    payload: {
      threadId: 'thread-live',
      turnId: null,
      error: expect.objectContaining({
        presentationScope: 'shared',
        source: 'invalid_stream_payload',
      }),
    },
  });
}

describe('createSessionEventHandlers', () => {
  it('routes malformed snapshot payloads into stream/error instead of dispatching stream/snapshot', () => {
    const { dispatch, handlers } = createHandlers();

    handlers.handleSnapshot(
      new MessageEvent('snapshot', {
        data: JSON.stringify({
          threadId: 'thread-live',
          turnExecution: {
            activeTurnId: null,
          },
          messages: [],
        }),
      }),
    );

    expectInvalidStreamPayloadDispatch(dispatch);
  });

  it('routes malformed turn_completed payloads into stream/error instead of dispatching stream/turn-completed', () => {
    const { dispatch, handlers } = createHandlers();

    handlers.handleTurnCompleted(
      new MessageEvent('turn_completed', {
        data: JSON.stringify({
          threadId: 'thread-live',
          turnId: 'turn-live',
        }),
      }),
    );

    expectInvalidStreamPayloadDispatch(dispatch);
  });

  it('routes malformed timeline_item_updated payloads into stream/error', () => {
    const { dispatch, handlers } = createHandlers();

    handlers.handleTimelineItemUpdated(
      new MessageEvent('timeline_item_updated', {
        data: JSON.stringify({
          threadId: 'thread-live',
          turnId: 'turn-live',
          item: { id: 'item-1', kind: 'message' },
        }),
      }),
    );

    expectInvalidStreamPayloadDispatch(dispatch);
  });

  it('routes malformed pending_request_updated payloads into stream/error', () => {
    const { dispatch, handlers } = createHandlers();

    handlers.handlePendingRequestUpdated(
      new MessageEvent('pending_request_updated', {
        data: JSON.stringify({
          threadId: 'thread-live',
          request: { id: 'request-1', kind: 'command_approval' },
        }),
      }),
    );

    expectInvalidStreamPayloadDispatch(dispatch);
  });

  it('routes malformed message_completed payloads into stream/error', () => {
    const { dispatch, handlers } = createHandlers();

    handlers.handleMessageCompleted(
      new MessageEvent('message_completed', {
        data: JSON.stringify({
          threadId: 'thread-live',
          turnId: 'turn-live',
          message: { id: 'assistant-1', kind: 'message', itemType: 'agentMessage' },
        }),
      }),
    );

    expectInvalidStreamPayloadDispatch(dispatch);
  });

  it('routes malformed assistant_delta payloads into stream/error', () => {
    const { dispatch, handlers } = createHandlers();

    handlers.handleAssistantDelta(
      new MessageEvent('assistant_delta', {
        data: JSON.stringify({
          threadId: 'thread-live',
          turnId: 'turn-live',
          delta: 'partial',
          text: 'partial',
        }),
      }),
    );

    expectInvalidStreamPayloadDispatch(dispatch);
  });

  it('routes malformed timeline_item_delta payloads into stream/error', () => {
    const { dispatch, handlers } = createHandlers();

    handlers.handleTimelineItemDelta(
      new MessageEvent('timeline_item_delta', {
        data: JSON.stringify({
          threadId: 'thread-live',
          turnId: 'turn-live',
          itemType: 'plan',
          deltaField: 'not-supported',
        }),
      }),
    );

    expectInvalidStreamPayloadDispatch(dispatch);
  });

  it('routes malformed session_meta_updated payloads into stream/error', () => {
    const { dispatch, handlers } = createHandlers();

    handlers.handleSessionMetaUpdated(
      new MessageEvent('session_meta_updated', {
        data: JSON.stringify({
          threadId: 'thread-live',
          threadName: 42,
        }),
      }),
    );

    expectInvalidStreamPayloadDispatch(dispatch);
  });

  it('routes malformed system_notice payloads into stream/error', () => {
    const { dispatch, handlers } = createHandlers();

    handlers.handleSystemNotice(
      new MessageEvent('system_notice', {
        data: JSON.stringify({
          threadId: 'thread-live',
          notice: { id: 'notice-1', title: 'Heads up', text: 'Be careful' },
        }),
      }),
    );

    expectInvalidStreamPayloadDispatch(dispatch);
  });

  it('routes malformed pending_request_resolved payloads into stream/error', () => {
    const { dispatch, handlers } = createHandlers();

    handlers.handlePendingRequestResolved(
      new MessageEvent('pending_request_resolved', {
        data: JSON.stringify({
          threadId: 'thread-live',
          requestId: 'request-1',
          notice: { id: 'notice-1', level: 'warning', title: 'Resolved' },
        }),
      }),
    );

    expectInvalidStreamPayloadDispatch(dispatch);
  });

  it('routes malformed error payloads into stream/error', () => {
    const { dispatch, handlers } = createHandlers();

    handlers.handleError(
      new MessageEvent('error', {
        data: JSON.stringify({
          threadId: 'thread-live',
          turnId: null,
          error: {
            message: 42,
          },
        }),
      }),
    );

    expectInvalidStreamPayloadDispatch(dispatch);
  });
});
