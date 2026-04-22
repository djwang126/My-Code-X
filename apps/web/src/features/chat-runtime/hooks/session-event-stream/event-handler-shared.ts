import type { SessionAction, SessionState } from '../../state/session-state';
import { parseEventData } from './event-data';
import { createInvalidStreamPayloadError } from '../../lib/session-payload-parse';

type Dispatch = React.Dispatch<SessionAction>;

export type ParsedStreamEventHandlerInput<T> = {
  dispatch: Dispatch;
  event: MessageEvent<string>;
  eventName: string;
  flushAssistantDeltas: () => void;
  parsePayload: (raw: unknown) => T;
  threadId: SessionState['threadId'];
  handlePayload: (payload: T) => void;
};

export function dispatchInvalidStreamPayload(
  dispatch: Dispatch,
  threadId: SessionState['threadId'],
  eventName: string,
  error: unknown,
) {
  dispatch({
    type: 'stream/error',
    payload: {
      threadId,
      turnId: null,
      error: createInvalidStreamPayloadError({ eventName, error, threadId }),
    },
  });
}

export function dispatchParsedStreamEvent<T>({
  dispatch,
  event,
  eventName,
  flushAssistantDeltas,
  parsePayload,
  threadId,
  handlePayload,
}: ParsedStreamEventHandlerInput<T>) {
  flushAssistantDeltas();

  try {
    const payload = parsePayload(parseEventData(event.data));
    handlePayload(payload);
  } catch (error) {
    dispatchInvalidStreamPayload(dispatch, threadId, eventName, error);
  }
}
