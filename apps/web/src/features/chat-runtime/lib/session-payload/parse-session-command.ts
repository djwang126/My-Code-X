import type { ChatInterruptAcceptedPayload, ChatMessageAcceptedPayload } from '../../session-types';
import { readRequiredBoolean, readRequiredRecord, readRequiredString } from './readers';
import { parseStreamingTurnExecution } from './turn-execution';

export function parseChatMessageAcceptedPayload(value: unknown): ChatMessageAcceptedPayload {
  const record = readRequiredRecord(value, 'chat message accepted payload');
  const stream = readRequiredRecord(record.stream, 'chat message accepted payload.stream');

  return {
    threadId: readRequiredString(record.threadId, 'chat message accepted payload.threadId'),
    turnExecution: parseStreamingTurnExecution(record.turnExecution, 'chat message accepted payload.turnExecution'),
    stream: {
      url: readRequiredString(stream.url, 'chat message accepted payload.stream.url'),
    },
  };
}

export function parseChatInterruptAcceptedPayload(value: unknown): ChatInterruptAcceptedPayload {
  const record = readRequiredRecord(value, 'chat interrupt accepted payload');

  return {
    ok: readRequiredBoolean(record.ok, 'chat interrupt accepted payload.ok'),
    threadId: readRequiredString(record.threadId, 'chat interrupt accepted payload.threadId'),
    turnExecution: parseStreamingTurnExecution(record.turnExecution, 'chat interrupt accepted payload.turnExecution'),
  };
}
